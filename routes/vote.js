'use strict';

const router = require('express').Router();
const db = require('../db');
const { getFingerprint } = require('../services/fingerprint');
const analytics = require('../services/analytics');
const picksService = require('../services/monthly-picks');
const { enrichBookMetadata } = require('../services/books');
const {
  getNomineesForBallot,
  seededShuffle,
  hasVoted,
  hasUserVoted,
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
router.get('/vote/:slug', async (req, res) => {
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

  // Already voted → redirect to results. Check the per-browser fingerprint and
  // (for logged-in members) the user_id, so a repeat visit from a different
  // browser/cookie still can't reach the ballot.
  if (hasVoted(meeting.id, fingerprint) || hasUserVoted(meeting.id, req.session?.userId)) {
    return res.redirect('/results/' + slug);
  }

  // Load nominees
  let rawNominees = getNomineesForBallot(meeting.id);

  // Lazy-enrich any nominees with missing metadata (description, publisher, page_count)
  // so the ballot "View details" dialog has rich content on first visit.
  // Runs in parallel and is non-fatal on failure.
  const needsEnrich = rawNominees.filter(
    (n) => n.description == null || n.publisher == null || n.page_count == null
  );
  if (needsEnrich.length > 0) {
    try {
      await Promise.all(
        needsEnrich.map((n) => enrichBookMetadata(n.book_id).catch(() => null))
      );
      // Re-fetch nominees to pick up the newly written fields
      rawNominees = getNomineesForBallot(meeting.id);
    } catch (err) {
      // Non-fatal — render with whatever data we have
      console.error('Ballot enrichment error:', err.message);
    }
  }

  // Shuffle deterministically per visitor
  const clientId = req.cookies._client_id;
  const nominees = seededShuffle(rawNominees, clientId);

  const voteCount = getVoteCount(meeting.id);

  // Build barMeeting: prefer event data from pick, fall back to meeting
  let barMeeting = meeting;
  if (pick) {
    const event = picksService.getFirstEvent(pick.id);
    if (event) barMeeting = event;
  }

  res.locals.layout = 'layouts/focus-shell';

  // Track ballot view with the same distinct-id pattern as vote_cast so funnels link.
  analytics.track(req.session?.userId || fingerprint, 'meeting_viewed', {
    kind: 'vote',
    meetingId: meeting.id,
    monthYear: meeting.month_year,
  });

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
