'use strict';

const router = require('express').Router();
const db = require('../db');
const meetings = require('../services/meetings');
const picksService = require('../services/monthly-picks');
const analytics = require('../services/analytics');
const { getFingerprint } = require('../services/fingerprint');
const { monthYearSlug } = require('../utils/format');
const { resolveMonth } = require('../utils/resolve-month');

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
  const resolved = resolveMonth(req.params.slug);
  if (!resolved) return res.redirect('/');

  const { meeting, pick, slug } = resolved;

  // Backward compat: if accessed by numeric ID, redirect to slug
  if (req.params.slug !== slug) {
    return res.redirect('/nominations/' + slug);
  }

  // Only show nominations page during nominations phase
  if (meeting.status !== 'nominations') {
    return res.redirect('/');
  }

  const nominees = meetings.getNominees(meeting.id);

  // Build barMeeting: prefer event data from pick, fall back to meeting
  let barMeeting = meeting;
  if (pick) {
    const event = picksService.getFirstEvent(pick.id);
    if (event) barMeeting = event;
  }

  res.locals.layout = 'layouts/focus-shell';

  const fingerprint = getFingerprint(req, res, meeting.id);
  analytics.track(req.session?.userId || fingerprint, 'meeting_viewed', {
    kind: 'nominations_live',
    meetingId: meeting.id,
    monthYear: meeting.month_year,
    nomineeCount: nominees.length,
  });

  res.render('nominations', {
    pageTitle: 'Nominations',
    pageScript: '/js/nominations-live.js',
    meeting,
    pick,
    meetingSlug: slug,
    nominees,
    barMeeting,
  });
});

module.exports = router;
