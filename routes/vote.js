'use strict';

const router = require('express').Router();
const db = require('../db');
const { getFingerprint } = require('../services/fingerprint');
const {
  getNomineesForBallot,
  seededShuffle,
  hasVoted,
  getVoteCount,
} = require('../services/voting');
const { monthYearSlug, parseMonthYearSlug } = require('../utils/format');

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
// GET /vote — auto-find current voting-open meeting
// ---------------------------------------------------------------------------
router.get('/vote', (req, res) => {
  const meeting = db.prepare(
    "SELECT * FROM meetings WHERE status = 'voting' ORDER BY month_year ASC LIMIT 1"
  ).get();

  if (!meeting) return res.redirect('/');

  res.redirect('/vote/' + monthYearSlug(meeting.month_year));
});

// ---------------------------------------------------------------------------
// GET /vote/:slug
// ---------------------------------------------------------------------------
router.get('/vote/:slug', (req, res) => {
  const meeting = resolveMeeting(req.params.slug);
  if (!meeting) return res.redirect('/');

  // Backward compat: if accessed by numeric ID, redirect to slug
  const slug = monthYearSlug(meeting.month_year);
  if (req.params.slug !== slug) {
    return res.redirect('/vote/' + slug);
  }

  // If voting is over, go straight to results
  if (meeting.status === 'results') {
    return res.redirect('/results/' + slug);
  }

  // Only allow access when status is 'voting'
  if (meeting.status !== 'voting') {
    return res.redirect('/');
  }

  // Set the _client_id cookie and derive this visitor's fingerprint
  const fingerprint = getFingerprint(req, res, meeting.id);

  // Already voted → redirect to results
  if (hasVoted(meeting.id, fingerprint)) {
    return res.redirect('/results/' + slug);
  }

  // Load nominees and shuffle them deterministically per visitor
  const clientId = req.cookies._client_id;
  const nominees = seededShuffle(getNomineesForBallot(meeting.id), clientId);

  const voteCount = getVoteCount(meeting.id);

  res.locals.layout = 'layouts/focus-shell';

  res.render('vote', {
    pageTitle: 'Cast Your Vote',
    pageScript: '/js/vote-ballot.js',
    meeting,
    meetingSlug: slug,
    nominees,
    voteCount,
  });
});

module.exports = router;
