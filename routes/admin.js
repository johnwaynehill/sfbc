'use strict';

const router = require('express').Router();
const db = require('../db');
const QRCode = require('qrcode');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const meetings = require('../services/meetings');
const { calculateResults, getVoteCount } = require('../services/voting');
const { formatMonthYear, parseMonthYearSlug, monthYearSlug } = require('../utils/format');

/* ------------------------------------------------------------------ */
/*  QR code helper                                                     */
/* ------------------------------------------------------------------ */

async function generateQrCodes(meeting_month_year, status) {
  const base = config.appUrl;
  const slug = monthYearSlug(meeting_month_year);
  const codes = [];

  if (status === 'nominations' || status === 'voting' || status === 'results') {
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
// Overview dashboard
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const current = meetings.getCurrent();
  const upcoming = meetings.getUpcoming();
  const stats = meetings.getStats();

  let nominees = [];
  let voteCount = 0;
  let results = null;
  let qrCodes = [];

  if (current) {
    nominees = meetings.getNominees(current.id);
    voteCount = getVoteCount(current.id);
    if (current.status === 'voting' || current.status === 'results') {
      results = calculateResults(current.id);
    }
    qrCodes = await generateQrCodes(current.month_year, current.status);
  }

  res.render('admin/overview', {
    pageTitle: 'Admin Overview',
    current,
    upcoming,
    stats,
    nominees,
    voteCount,
    results,
    qrCodes,
  });
});

// ---------------------------------------------------------------------------
// Meetings list
// ---------------------------------------------------------------------------
router.get('/meetings', (req, res) => {
  const allMeetings = meetings.getAll();
  const activeMeetings = allMeetings.filter(m => m.status !== 'results');
  const finishedMeetings = allMeetings.filter(m => m.status === 'results');
  res.render('admin/meetings', {
    pageTitle: 'Meetings',
    meetings: allMeetings,
    activeMeetings,
    finishedMeetings,
  });
});

// ---------------------------------------------------------------------------
// New meeting form
// ---------------------------------------------------------------------------
router.get('/meetings/new', (req, res) => {
  res.render('admin/meeting-detail', {
    pageTitle: 'New Meeting',
    pageScript: '/js/admin-meetings.js',
    meeting: null,
    nominees: [],
    voteCount: 0,
    results: null,
    qrCodes: [],
  });
});

// ---------------------------------------------------------------------------
// Meeting detail (supports slug like "february-2026" or numeric ID for backward compat)
// ---------------------------------------------------------------------------
router.get('/meetings/:slug', async (req, res) => {
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
        return res.redirect(`/admin/meetings/${monthYearSlug(meeting.month_year)}`);
      }
    }
  }

  if (!meeting) return res.redirect('/admin/meetings');

  const nominees = meetings.getNominees(meeting.id);
  const voteCount = getVoteCount(meeting.id);
  let results = null;
  if (meeting.status === 'voting' || meeting.status === 'results') {
    results = calculateResults(meeting.id);
  }

  const qrCodes = await generateQrCodes(meeting.month_year, meeting.status);

  res.render('admin/meeting-detail', {
    pageTitle: formatMonthYear(meeting.month_year),
    pageScript: '/js/admin-meetings.js',
    meeting,
    nominees,
    voteCount,
    results,
    qrCodes,
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
router.get('/settings', (req, res) => {
  const admins = db.prepare("SELECT id, email, display_name FROM users WHERE role = 'admin' ORDER BY id").all();

  res.render('admin/settings', {
    pageTitle: 'Settings',
    admins,
  });
});

module.exports = router;
