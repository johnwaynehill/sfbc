'use strict';

const router = require('express').Router();
const db = require('../db');
const { calculateResults } = require('../services/voting');
const { bookPath } = require('../utils/slug');

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
// GET /results/:meetingId
// ---------------------------------------------------------------------------
router.get('/results/:meetingId', (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) return res.redirect('/');

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) return res.redirect('/');

  // Allow viewing during voting and after
  if (meeting.status !== 'voting' && meeting.status !== 'results') {
    return res.redirect('/');
  }

  const isVotingOpen = meeting.status === 'voting';
  const results = calculateResults(meetingId);

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
    results,
    isVotingOpen,
    winner,
    bookPath,
    colors,
  });
});

module.exports = router;
