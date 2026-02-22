'use strict';

const router = require('express').Router();
const db = require('../db');
const { getFingerprint } = require('../services/fingerprint');
const { monthYearSlug, parseMonthYearSlug } = require('../utils/format');

// ---------------------------------------------------------------------------
// Helper: resolve a meeting from a slug or numeric ID param
// ---------------------------------------------------------------------------
function resolveMeeting(param) {
  // Try month-year slug first (e.g. "january-2026")
  const monthYear = parseMonthYearSlug(param);
  if (monthYear) {
    return db.prepare('SELECT * FROM meetings WHERE month_year = ?').get(monthYear) || null;
  }
  // Fall back to numeric ID for backward compatibility
  const id = parseInt(param, 10);
  if (!isNaN(id)) {
    return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /nominate — auto-find current nominations-open meeting
// ---------------------------------------------------------------------------
router.get('/nominate', (req, res) => {
  const meeting = db.prepare(
    "SELECT * FROM meetings WHERE status = 'nominations' ORDER BY month_year ASC LIMIT 1"
  ).get();

  if (!meeting) return res.redirect('/');

  // Redirect to the canonical slug URL
  res.redirect('/nominate/' + monthYearSlug(meeting.month_year));
});

// ---------------------------------------------------------------------------
// GET /nominate/:slug
// ---------------------------------------------------------------------------
router.get('/nominate/:slug', (req, res) => {
  const meeting = resolveMeeting(req.params.slug);
  if (!meeting) return res.redirect('/');

  // Backward compat: if accessed by numeric ID, redirect to slug
  const expectedSlug = monthYearSlug(meeting.month_year);
  if (req.params.slug !== expectedSlug) {
    const qs = req.query.edit === '1' ? '?edit=1' : '';
    return res.redirect('/nominate/' + expectedSlug + qs);
  }

  if (meeting.status !== 'nominations') {
    return res.redirect('/');
  }

  // Set the _client_id cookie and derive this visitor's fingerprint
  const fingerprint = getFingerprint(req, res, meeting.id);

  // Check if this visitor has already nominated
  const existing = db.prepare(`
    SELECT n.*, b.title, b.author, b.cover_url
    FROM nominations n
    JOIN books b ON b.id = n.book_id
    WHERE n.meeting_id = ? AND n.submitted_fingerprint = ?
  `).get(meeting.id, fingerprint);

  res.locals.layout = 'layouts/focus-shell';

  // ?edit=1 lets a user re-submit (change their nomination)
  const wantsEdit = req.query.edit === '1' && existing;

  res.render('nominate', {
    pageTitle: wantsEdit ? 'Edit Nomination' : 'Nominate a Book',
    pageScript: '/js/nominate-form.js',
    meeting,
    meetingSlug: expectedSlug,
    alreadyNominated: !wantsEdit && !!existing,
    existingNomination: existing || null,
    editMode: !!wantsEdit,
  });
});

module.exports = router;
