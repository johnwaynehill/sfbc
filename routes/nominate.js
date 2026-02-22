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
    SELECT n.*, b.title, b.author, b.cover_url
    FROM nominations n
    JOIN books b ON b.id = n.book_id
    WHERE n.meeting_id = ? AND n.submitted_fingerprint = ?
  `).get(meetingId, fingerprint);

  res.locals.layout = 'layouts/focus-shell';

  // ?edit=1 lets a user re-submit (change their nomination)
  const wantsEdit = req.query.edit === '1' && existing;

  res.render('nominate', {
    pageTitle: wantsEdit ? 'Edit Nomination' : 'Nominate a Book',
    pageScript: '/js/nominate-form.js',
    meeting,
    alreadyNominated: !wantsEdit && !!existing,
    existingNomination: existing || null,
    editMode: !!wantsEdit,
  });
});

module.exports = router;
