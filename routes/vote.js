'use strict';

const router = require('express').Router();
const db = require('../db');
const { getFingerprint } = require('../services/fingerprint');
const picksService = require('../services/monthly-picks');
const {
  getNomineesForBallot,
  seededShuffle,
  hasVoted,
  getVoteCount,
} = require('../services/voting');
const { monthYearSlug } = require('../utils/format');
const { resolveMonth } = require('../utils/resolve-month');

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
  const resolved = resolveMonth(req.params.slug);
  if (!resolved) return res.redirect('/');

  const { meeting, pick, slug } = resolved;

  // Backward compat: if accessed by numeric ID, redirect to slug
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

  // Build barMeeting: prefer event data from pick, fall back to meeting
  let barMeeting = meeting;
  if (pick) {
    const event = picksService.getFirstEvent(pick.id);
    if (event) barMeeting = event;
  }

  res.locals.layout = 'layouts/focus-shell';

  res.render('vote', {
    pageTitle: 'Cast Your Vote',
    pageScript: '/js/vote-ballot.js',
    meeting,
    pick,
    meetingSlug: slug,
    nominees,
    voteCount,
    barMeeting,
  });
});

module.exports = router;
