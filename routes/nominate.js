'use strict';

const router = require('express').Router();
const db = require('../db');
const { getFingerprint } = require('../services/fingerprint');

// ---------------------------------------------------------------------------
// GET /nominate/:meetingId
// ---------------------------------------------------------------------------
router.get('/nominate/:meetingId', (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) return res.redirect('/');

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting || meeting.status !== 'nominations') {
    return res.redirect('/');
  }

  // Set the _client_id cookie and derive this visitor's fingerprint
  const fingerprint = getFingerprint(req, res, meetingId);

  // Check if this visitor has already nominated
  const existing = db.prepare(`
    SELECT n.*, b.title, b.author
    FROM nominations n
    JOIN books b ON b.id = n.book_id
    WHERE n.meeting_id = ? AND n.submitted_fingerprint = ?
  `).get(meetingId, fingerprint);

  res.locals.layout = 'layouts/focus-shell';

  res.render('nominate', {
    pageTitle: 'Nominate a Book',
    pageScript: '/js/nominate-form.js',
    meeting,
    alreadyNominated: !!existing,
    existingNomination: existing || null,
  });
});

module.exports = router;
