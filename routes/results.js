'use strict';

const router = require('express').Router();
const db = require('../db');
const { calculateResults } = require('../services/voting');
const { bookPath } = require('../utils/slug');
const { monthYearSlug, parseMonthYearSlug } = require('../utils/format');

// Accessible 8-color palette for bar chart fills
const BAR_COLORS = [
  '#E8593F', // vermillion
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

// ---------------------------------------------------------------------------
// Helper: resolve a meeting from a slug or numeric ID param
// ---------------------------------------------------------------------------
function resolveMeeting(param) {
  const monthYear = parseMonthYearSlug(param);
  if (monthYear) {
    return db.prepare('SELECT * FROM meetings WHERE month_year = ?').get(monthYear) || null;
  }
  const id = parseInt(param, 10);
  if (!isNaN(id)) {
    return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /results — auto-find current voting/results meeting
// ---------------------------------------------------------------------------
router.get('/results', (req, res) => {
  // Prefer a meeting in voting status (live results), fall back to most recent finished
  const meeting = (
    db.prepare(
      "SELECT * FROM meetings WHERE status = 'voting' ORDER BY month_year ASC LIMIT 1"
    ).get()
    ||
    db.prepare(
      "SELECT * FROM meetings WHERE status = 'results' ORDER BY month_year DESC LIMIT 1"
    ).get()
  );

  if (!meeting) return res.redirect('/');

  res.redirect('/results/' + monthYearSlug(meeting.month_year));
});

// ---------------------------------------------------------------------------
// GET /results/:slug
// ---------------------------------------------------------------------------
router.get('/results/:slug', (req, res) => {
  const meeting = resolveMeeting(req.params.slug);
  if (!meeting) return res.redirect('/');

  // Backward compat: if accessed by numeric ID, redirect to slug
  const slug = monthYearSlug(meeting.month_year);
  if (req.params.slug !== slug) {
    return res.redirect('/results/' + slug);
  }

  // Allow viewing during voting and after
  if (meeting.status !== 'voting' && meeting.status !== 'results') {
    return res.redirect('/');
  }

  const isVotingOpen = meeting.status === 'voting';

  // During voting: always calculate live. After voting: prefer cached JSON.
  const results = (!isVotingOpen && meeting.vote_results_json)
    ? JSON.parse(meeting.vote_results_json)
    : calculateResults(meeting.id);

  // Assign colors to each nominee
  const colors = {};
  results.rankings.forEach((r, i) => {
    colors[r.book_id] = BAR_COLORS[i % BAR_COLORS.length];
  });

  // Winner is only revealed when voting is closed
  const winner = (!isVotingOpen && results.rankings.length > 0)
    ? results.rankings[0]
    : null;

  res.locals.layout = 'layouts/focus-shell';

  res.render('results', {
    pageTitle: isVotingOpen ? 'Live Results' : 'Final Results',
    pageScript: '/js/results-live.js',
    meeting,
    meetingSlug: slug,
    results,
    isVotingOpen,
    winner,
    bookPath,
    colors,
  });
});

module.exports = router;
