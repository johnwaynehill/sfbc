'use strict';

const router = require('express').Router();
const db = require('../db');
const meetings = require('../services/meetings');
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
// GET /nominations — auto-find current nominations-open meeting
// ---------------------------------------------------------------------------
router.get('/nominations', (req, res) => {
  const meeting = db.prepare(
    "SELECT * FROM meetings WHERE status = 'nominations' ORDER BY month_year ASC LIMIT 1"
  ).get();

  if (!meeting) return res.redirect('/');

  res.redirect('/nominations/' + monthYearSlug(meeting.month_year));
});

// ---------------------------------------------------------------------------
// GET /nominations/:slug — view live nominations
// ---------------------------------------------------------------------------
router.get('/nominations/:slug', (req, res) => {
  const meeting = resolveMeeting(req.params.slug);
  if (!meeting) return res.redirect('/');

  // Backward compat: if accessed by numeric ID, redirect to slug
  const expectedSlug = monthYearSlug(meeting.month_year);
  if (req.params.slug !== expectedSlug) {
    return res.redirect('/nominations/' + expectedSlug);
  }

  // Only show nominations page during nominations phase
  if (meeting.status !== 'nominations') {
    return res.redirect('/');
  }

  const nominees = meetings.getNominees(meeting.id);

  res.locals.layout = 'layouts/focus-shell';

  res.render('nominations', {
    pageTitle: 'Nominations',
    pageScript: '/js/nominations-live.js',
    meeting,
    meetingSlug: expectedSlug,
    nominees,
  });
});

module.exports = router;
