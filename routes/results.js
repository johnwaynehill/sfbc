'use strict';

const router = require('express').Router();
const db = require('../db');
const { calculateResults } = require('../services/voting');
const picksService = require('../services/monthly-picks');
const { bookPath } = require('../utils/slug');
const { monthYearSlug } = require('../utils/format');
const { resolveMonth } = require('../utils/resolve-month');

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
// GET /results — auto-find current voting/results meeting
// ---------------------------------------------------------------------------
router.get('/results', (req, res) => {
  // Prefer voting (live), then upcoming/reading with results, then most recent finished
  const meeting = (
    db.prepare(
      "SELECT * FROM meetings WHERE status = 'voting' ORDER BY month_year ASC LIMIT 1"
    ).get()
    ||
    db.prepare(
      "SELECT * FROM meetings WHERE status IN ('upcoming', 'reading') ORDER BY month_year DESC LIMIT 1"
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
  const resolved = resolveMonth(req.params.slug);
  if (!resolved) return res.redirect('/');

  const { meeting, pick, slug } = resolved;

  // Backward compat: if accessed by numeric ID, redirect to slug
  if (req.params.slug !== slug) {
    return res.redirect('/results/' + slug);
  }

  // Allow viewing during voting, upcoming (post-voting), reading, and when finished
  const canViewResults = ['voting', 'upcoming', 'reading', 'results'].includes(meeting.status);
  if (!canViewResults) {
    return res.redirect('/');
  }

  const isVotingOpen = meeting.status === 'voting';

  // Prefer pick's results JSON when available; fall back to meeting's; recalculate live during voting
  const cachedJson = (pick && pick.vote_results_json) || meeting.vote_results_json;
  const results = (!isVotingOpen && cachedJson)
    ? JSON.parse(cachedJson)
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

  // Build barMeeting: prefer event data from pick, fall back to meeting
  let barMeeting = meeting;
  if (pick) {
    const event = picksService.getFirstEvent(pick.id);
    if (event) barMeeting = event;
  }

  res.locals.layout = 'layouts/focus-shell';

  res.render('results', {
    pageTitle: isVotingOpen ? 'Live Results' : 'Final Results',
    pageScript: '/js/results-live.js',
    meeting,
    pick,
    meetingSlug: slug,
    results,
    isVotingOpen,
    winner,
    bookPath,
    colors,
    barMeeting,
  });
});

module.exports = router;
