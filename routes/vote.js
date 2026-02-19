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

// ---------------------------------------------------------------------------
// GET /vote/:meetingId
// ---------------------------------------------------------------------------
router.get('/vote/:meetingId', (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) return res.redirect('/');

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) return res.redirect('/');

  // If voting is over, go straight to results
  if (meeting.status === 'results') {
    return res.redirect('/results/' + meetingId);
  }

  // Only allow access when status is 'voting'
  if (meeting.status !== 'voting') {
    return res.redirect('/');
  }

  // Set the _client_id cookie and derive this visitor's fingerprint
  const fingerprint = getFingerprint(req, res, meetingId);

  // Already voted → redirect to results
  if (hasVoted(meetingId, fingerprint)) {
    return res.redirect('/results/' + meetingId);
  }

  // Load nominees and shuffle them deterministically per visitor
  const clientId = req.cookies._client_id;
  const nominees = seededShuffle(getNomineesForBallot(meetingId), clientId);

  const voteCount = getVoteCount(meetingId);

  res.locals.layout = 'layouts/focus-shell';

  res.render('vote', {
    pageTitle: 'Cast Your Vote',
    pageScript: '/js/vote-ballot.js',
    meeting,
    nominees,
    voteCount,
  });
});

module.exports = router;
