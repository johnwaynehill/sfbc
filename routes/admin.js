'use strict';

const router = require('express').Router();
const db = require('../db');
const QRCode = require('qrcode');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const meetings = require('../services/meetings');
const picksService = require('../services/monthly-picks');
const { calculateResults, getVoteCount, getVotesForMeeting, getNomineesForBallot } = require('../services/voting');
const { formatMonthYear, formatMeetingTime, parseMonthYearSlug, monthYearSlug } = require('../utils/format');

/* ------------------------------------------------------------------ */
/*  Pagination helper                                                  */
/* ------------------------------------------------------------------ */

function parsePagination(query, defaultPer = 25) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const per = Math.min(100, Math.max(10, parseInt(query.per, 10) || defaultPer));
  const offset = (page - 1) * per;
  return { page, per, offset };
}

/* ------------------------------------------------------------------ */
/*  QR code helper                                                     */
/* ------------------------------------------------------------------ */

async function generateQrCodes(meeting_month_year, status) {
  const base = config.appUrl;
  const slug = monthYearSlug(meeting_month_year);
  const codes = [];

  if (['scheduled', 'nominations', 'voting', 'results'].includes(status)) {
    codes.push({ label: 'Nominate', url: `${base}/nominate/${slug}` });
  }
  if (status === 'voting' || status === 'results') {
    codes.push({ label: 'Vote', url: `${base}/vote/${slug}` });
  }
  codes.push({ label: 'Results', url: `${base}/results/${slug}` });

  for (const code of codes) {
    code.dataUrl = await QRCode.toDataURL(code.url, {
      width: 200,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
  }

  return codes;
}

// ---------------------------------------------------------------------------
// Admin login page (no auth required)
// ---------------------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (user && user.role === 'admin') {
      return res.redirect('/admin');
    }
  }
  res.locals.layout = 'layouts/focus-shell';
  res.render('admin/login', { pageTitle: 'Admin Login', error: null });
});

// ---------------------------------------------------------------------------
// All routes below require admin auth
// ---------------------------------------------------------------------------
router.use(requireAdmin);

router.use((req, res, next) => {
  res.locals.layout = 'layouts/admin-shell';
  res.locals.adminPath = req.path;
  res.locals.isSuperAdmin = !!(req.user && req.user.isSuperAdmin);
  next();
});

// ---------------------------------------------------------------------------
// 301 redirects: /admin/meetings → /admin/picks
// ---------------------------------------------------------------------------
router.get('/meetings', (req, res) => res.redirect(301, '/admin/picks'));
router.get('/meetings/new', (req, res) => {
  const qs = req.originalUrl.split('?')[1];
  res.redirect(301, '/admin/picks/new' + (qs ? '?' + qs : ''));
});
router.get('/meetings/:slug', (req, res) => {
  res.redirect(301, '/admin/picks/' + req.params.slug);
});

// ---------------------------------------------------------------------------
// Overview dashboard
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const currentPick = picksService.getCurrent();
  const upcoming = meetings.getUpcoming();
  const stats = meetings.getStats();

  // Build `current` for the template.
  // Strategy: start from the pick (authoritative lifecycle entity, always has book),
  // then find *its* linked meeting for nominee/vote data.
  // Fall back to meetings.getCurrent() only when there's no pick at all
  // (nominations phase with no book selected yet).
  let current = null;
  if (currentPick) {
    // Find the meeting linked to THIS pick (not just any current meeting)
    const linked = meetings.getByPickId(currentPick.id);
    current = {
      id: linked ? linked.id : null,
      month_year: currentPick.month_year,
      status: currentPick.status,
      book_title: currentPick.title,
      book_author: currentPick.author,
      book_cover_url: currentPick.cover_url,
      winning_book_id: currentPick.book_id,
    };
  } else {
    // No pick — fall back to meetings (nominations phase, no book yet)
    const currentMeeting = meetings.getCurrent();
    if (currentMeeting) current = currentMeeting;
  }

  let nominees = [];
  let voteCount = 0;
  let qrCodes = [];

  if (current && current.id) {
    nominees = meetings.getNominees(current.id);
    voteCount = getVoteCount(current.id);
    qrCodes = await generateQrCodes(current.month_year, current.status);
  }

  res.render('admin/overview', {
    pageTitle: 'Admin Overview',
    current,
    upcoming,
    stats,
    nominees,
    voteCount,
    qrCodes,
  });
});

// ---------------------------------------------------------------------------
// Picks list
// ---------------------------------------------------------------------------
router.get('/picks', (req, res) => {
  const allMeetings = meetings.getAll();
  const activeMeetings = allMeetings.filter(m => m.status !== 'results');
  const finishedMeetings = allMeetings.filter(m => m.status === 'results');
  res.render('admin/picks', {
    pageTitle: 'Picks',
    meetings: allMeetings,
    activeMeetings,
    finishedMeetings,
  });
});

// ---------------------------------------------------------------------------
// New pick form
// ---------------------------------------------------------------------------
router.get('/picks/new', (req, res) => {
  res.render('admin/pick-detail', {
    pageTitle: 'New Pick',
    pageScript: '/js/admin-picks.js',
    meeting: null,
    nominees: [],
    voteCount: 0,
    results: null,
    qrCodes: [],
    events: [],
    formatMeetingTime,
  });
});

// ---------------------------------------------------------------------------
// Pick detail (supports slug like "february-2026" or numeric ID for backward compat)
// ---------------------------------------------------------------------------
router.get('/picks/:slug', async (req, res) => {
  const slug = req.params.slug;
  let meeting;

  // Try slug format first (e.g. "february-2026")
  const monthYear = parseMonthYearSlug(slug);
  if (monthYear) {
    meeting = meetings.getByMonthYear(monthYear);
  } else {
    // Fall back to numeric ID for backward compatibility
    const id = parseInt(slug, 10);
    if (!isNaN(id)) {
      meeting = meetings.getById(id);
      // Redirect numeric ID to slug URL
      if (meeting) {
        return res.redirect(`/admin/picks/${monthYearSlug(meeting.month_year)}`);
      }
    }
  }

  if (!meeting) return res.redirect('/admin/picks');

  const nominees = meetings.getNominees(meeting.id);
  const voteCount = getVoteCount(meeting.id);
  let results = null;
  if (['voting', 'results', 'reading', 'upcoming'].includes(meeting.status)) {
    results = calculateResults(meeting.id);
    // Fall back to cached JSON for imported results (no rows in votes table)
    if ((!results || results.voteCount === 0) && meeting.status === 'results') {
      const pick = picksService.getByMonthYear(meeting.month_year);
      const cachedJson = (pick && pick.vote_results_json) || meeting.vote_results_json;
      if (cachedJson) results = JSON.parse(cachedJson);
    }
  }

  const qrCodes = await generateQrCodes(meeting.month_year, meeting.status);

  // Also resolve the linked pick for future use
  const pick = picksService.getByMonthYear(meeting.month_year);
  const events = pick ? picksService.getEvents(pick.id) : [];

  // Secret votes inspector: ?show-votes=yes
  let votes = null;
  let bookMap = null;
  if (req.query['show-votes'] === 'yes') {
    votes = getVotesForMeeting(meeting.id);
    const allNominees = getNomineesForBallot(meeting.id);
    bookMap = {};
    for (const n of allNominees) {
      bookMap[n.book_id] = n.title;
    }
  }

  res.render('admin/pick-detail', {
    pageTitle: formatMonthYear(meeting.month_year),
    pageScript: '/js/admin-picks.js',
    meeting,
    pick,
    nominees,
    voteCount,
    results,
    qrCodes,
    events,
    formatMeetingTime,
    votes,
    bookMap,
  });
});

// ---------------------------------------------------------------------------
// Import Results (bulk backfill tool)
// ---------------------------------------------------------------------------
router.get('/import-results', (req, res) => {
  const allMeetings = meetings.getAll();
  const finishedMeetings = allMeetings.filter(m => m.status === 'results');

  const coverage = finishedMeetings.map(m => {
    const pick = picksService.getByMonthYear(m.month_year);
    const hasResults = !!(m.vote_results_json || (pick && pick.vote_results_json));
    return {
      month_year: m.month_year,
      book_title: m.book_title || '(no winner)',
      book_author: m.book_author || '',
      hasResults,
    };
  });

  res.render('admin/import-results', {
    pageTitle: 'Import Results',
    pageScript: '/js/admin-import-results.js',
    coverage,
    withResults: coverage.filter(c => c.hasResults).length,
    withoutResults: coverage.filter(c => !c.hasResults).length,
    totalFinished: finishedMeetings.length,
  });
});

// ---------------------------------------------------------------------------
// Users list
// ---------------------------------------------------------------------------
router.get('/users', (req, res) => {
  const { page, per, offset } = parsePagination(req.query);
  const total = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  const totalPages = Math.ceil(total / per) || 1;

  const users = db.prepare(`
    SELECT id, email, display_name, role, avatar_style, user_slug, username, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(per, offset);

  res.render('admin/users', {
    pageTitle: 'Users',
    pageScript: '/js/admin-users.js',
    users,
    total,
    page,
    per,
    totalPages,
    maskEmail(email) {
      const [local, domain] = email.split('@');
      if (local.length <= 2) return local[0] + '***@' + domain;
      return local[0] + '***' + local[local.length - 1] + '@' + domain;
    },
  });
});

// ---------------------------------------------------------------------------
// Reviews list
// ---------------------------------------------------------------------------
router.get('/reviews', (req, res) => {
  const { page, per, offset } = parsePagination(req.query);
  const total = db.prepare('SELECT COUNT(*) AS total FROM reviews').get().total;
  const totalPages = Math.ceil(total / per) || 1;

  const reviews = db.prepare(`
    SELECT r.id, r.grade, r.body_markdown, r.created_at,
           u.display_name, u.email,
           b.title AS book_title, b.author AS book_author,
           b.title_slug, b.author_slug
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    JOIN books b ON b.id = r.book_id
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(per, offset);

  res.render('admin/reviews', {
    pageTitle: 'Reviews',
    pageScript: '/js/admin-reviews.js',
    reviews,
    total,
    page,
    per,
    totalPages,
  });
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
const announcementsService = require('../services/announcements');

router.get('/announcements', (req, res) => {
  const announcements = announcementsService.getAll();
  res.render('admin/announcements', {
    pageTitle: 'Announcements',
    pageScript: '/js/admin-announcements.js',
    announcements,
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
router.get('/settings', (req, res) => {
  const admins = db.prepare("SELECT id, email, display_name FROM users WHERE role = 'admin' ORDER BY id").all();
  const libraryUrl = db.prepare("SELECT value FROM site_settings WHERE key = 'library_url'").get();

  res.render('admin/settings', {
    pageTitle: 'Settings',
    admins,
    libraryUrl: libraryUrl ? libraryUrl.value : '',
  });
});

module.exports = router;
