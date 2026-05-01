const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const analytics = require('../services/analytics');
const { slugify } = require('../utils/slug');
const { searchGoogleBooks, searchGoogleBooksMulti, findOrCreateBook, downloadCover } = require('../services/books');
const { getFingerprint } = require('../services/fingerprint');
const {
  getNomineesForBallot,
  hasVoted,
  calculateResults,
} = require('../services/voting');
const meetings = require('../services/meetings');
const picksService = require('../services/monthly-picks');
const { requireAdmin, requireMember } = require('../middleware/auth');
const { monthYearSlug } = require('../utils/format');
const { validationResult } = require('express-validator');
const {
  handleValidationErrors,
  emailChain,
  passwordChain,
  displayNameChain,
  newPasswordChain,
  socialLinksChain,
  reviewChain,
  nominationChain,
  meetingChain,
  meetingStatusChain,
  announcementChain,
  emojiChain,
  sanitizeTextChain,
} = require('../middleware/validate');

// ---------------------------------------------------------------------------
// Submission rate limiter — 10 per 15 min per IP (nominations + votes)
// ---------------------------------------------------------------------------
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again in a few minutes.' },
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Admin bootstrap (one-time first admin creation)
// POST /api/admin/bootstrap
// ---------------------------------------------------------------------------
router.post('/admin/bootstrap', ...emailChain, ...passwordChain, handleValidationErrors, (req, res) => {
  const { bootstrapKey } = req.body;

  if (!config.bootstrapKey || config.bootstrapKey.trim() === '') {
    return res.status(403).json({
      error: 'Bootstrap is not configured. Set BOOTSTRAP_KEY in your .env file.',
    });
  }

  if (bootstrapKey !== config.bootstrapKey) {
    return res.status(403).json({ error: 'Invalid bootstrap key.' });
  }

  const existingAdmin = db.prepare(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  ).get();

  if (existingAdmin) {
    return res.status(409).json({
      error: 'An admin account already exists. Use admin settings to add more admins.',
    });
  }

  const hash = bcrypt.hashSync(req.body.password, 12);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')"
  ).run(req.body.email, hash);

  res.status(201).json({
    message: 'Admin account created successfully.',
    userId: Number(result.lastInsertRowid),
  });
});

// ---------------------------------------------------------------------------
// Admin login
// POST /api/auth/admin-login
// ---------------------------------------------------------------------------
router.post('/auth/admin-login', ...emailChain, handleValidationErrors, (req, res) => {
  const password = req.body.password || '';

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const user = db.prepare(
    "SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = 'admin'"
  ).get(req.body.email);

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Session error.' });
    }
    res.json({ message: 'Login successful.', redirect: '/admin' });
  });
});

// ---------------------------------------------------------------------------
// Admin logout
// POST /api/auth/admin-logout
// ---------------------------------------------------------------------------
router.post('/auth/admin-logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, redirect: '/admin/login' });
  });
});

// ---------------------------------------------------------------------------
// Check username availability
// GET /api/auth/check-username?username=...
// ---------------------------------------------------------------------------
router.get('/auth/check-username', requireMember, (req, res) => {
  const username = (req.query.username || '').trim().toLowerCase();
  if (!username) return res.json({ available: true, username: '' });

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username) && username.length > 1 || username.length < 3) {
    return res.json({ available: false, username, error: 'Must be 3-30 chars: letters, numbers, hyphens.' });
  }

  const taken = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
  if (!taken) {
    return res.json({ available: true, username });
  }

  // Username is taken — compute suggestion
  let n = 2;
  while (db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username + '-' + n, req.user.id)) {
    n++;
  }
  res.json({ available: false, username, suggestion: username + '-' + n });
});

// ---------------------------------------------------------------------------
// Update display name
// PUT /api/auth/display-name
// ---------------------------------------------------------------------------
router.put('/auth/display-name', requireMember, ...displayNameChain, handleValidationErrors, (req, res) => {
  const name = req.body.display_name; // already trimmed + length-checked by chain

  // Check if user already has a username — if so, don't change slug
  const current = db.prepare('SELECT username, user_slug FROM users WHERE id = ?').get(req.user.id);

  if (current.username) {
    // User has a username — only update display_name
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, req.user.id);
    analytics.track(req.user.id, 'profile_updated', { field: 'display_name' });
    res.json({ success: true, display_name: name, user_slug: current.user_slug });
  } else {
    // No username yet — auto-generate slug from display name (legacy behavior)
    const base = slugify(name) || 'member';
    let slug = base;
    let n = 2;
    while (db.prepare('SELECT 1 FROM users WHERE user_slug = ? AND id != ?').get(slug, req.user.id)) {
      slug = base + '-' + n++;
    }
    db.prepare('UPDATE users SET display_name = ?, user_slug = ?, username = ? WHERE id = ?').run(name, slug, slug, req.user.id);
    analytics.track(req.user.id, 'profile_updated', { field: 'display_name' });
    res.json({ success: true, display_name: name, user_slug: slug, username: slug });
  }
});

// ---------------------------------------------------------------------------
// Update username
// PUT /api/auth/username
// ---------------------------------------------------------------------------
router.put('/auth/username', requireMember, (req, res) => {
  const username = (req.body.username || '').trim().toLowerCase();

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3-30 characters.' });
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(username)) {
    return res.status(400).json({ error: 'Letters, numbers, and hyphens only. Cannot start or end with a hyphen.' });
  }

  const taken = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
  if (taken) {
    return res.status(409).json({ error: 'Username is already taken.' });
  }

  db.prepare('UPDATE users SET username = ?, user_slug = ? WHERE id = ?').run(username, username, req.user.id);
  analytics.track(req.user.id, 'profile_updated', { field: 'username' });
  res.json({ success: true, username });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/password — set or change password (member)
// ---------------------------------------------------------------------------
router.put('/auth/password', requireMember, ...newPasswordChain, handleValidationErrors, (req, res) => {
  const { current_password, new_password } = req.body;

  // If user already has a password, require current_password
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (user.password_hash) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(403).json({ error: 'Current password is incorrect.' });
    }
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/social-links — update social profile links (member)
// ---------------------------------------------------------------------------
router.put('/auth/social-links', requireMember, ...socialLinksChain, handleValidationErrors, (req, res) => {
  // Values already trimmed, stripped of @, and length-checked by chain
  const goodreads_url = req.body.goodreads_url || '';
  const storygraph_url = req.body.storygraph_url || '';
  const instagram_handle = req.body.instagram_handle || '';
  const threads_handle = req.body.threads_handle || '';

  db.prepare(`
    UPDATE users
    SET goodreads_url = ?, storygraph_url = ?, instagram_handle = ?, threads_handle = ?
    WHERE id = ?
  `).run(goodreads_url, storygraph_url, instagram_handle, threads_handle, req.user.id);

  analytics.track(req.user.id, 'profile_updated', { field: 'social_links' });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/avatar-style — update avatar style (member)
// ---------------------------------------------------------------------------
const VALID_AVATAR_STYLES = [
  // Classic / geometric
  'initials', 'identicon', 'rings', 'shapes',
  // Illustrated characters
  'lorelei', 'micah', 'miniavs', 'personas',
  'notionists', 'notionists-neutral',
  'open-peeps', 'big-smile',
  'big-ears', 'big-ears-neutral',
  'adventurer-neutral', 'dylan', 'glass',
  // Fun / playful
  'bottts', 'thumbs', 'fun-emoji',
  'avataaars', 'avataaars-neutral',
  'croodles', 'croodles-neutral',
  'pixel-art', 'pixel-art-neutral',
];

router.put('/auth/avatar-style', requireMember, (req, res) => {
  const style = (req.body.avatar_style || '').trim();
  if (!VALID_AVATAR_STYLES.includes(style)) {
    return res.status(400).json({ error: 'Invalid avatar style.' });
  }

  db.prepare('UPDATE users SET avatar_style = ? WHERE id = ?').run(style, req.user.id);
  res.json({ success: true, avatar_style: style });
});

// ---------------------------------------------------------------------------
// Create admin user
// POST /api/admin/users
// ---------------------------------------------------------------------------
router.post('/admin/users', requireAdmin, ...emailChain, ...passwordChain, handleValidationErrors, (req, res) => {
  const email = req.body.email; // already trimmed + lowercased + validated by chain

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }

  const hash = bcrypt.hashSync(req.body.password, 12);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, 'admin', ?)"
  ).run(email, hash, email.split('@')[0]);

  res.status(201).json({
    success: true,
    user: { id: Number(result.lastInsertRowid), email },
  });
});

// ---------------------------------------------------------------------------
// Create meeting
// POST /api/admin/meetings
// ---------------------------------------------------------------------------
router.post('/admin/meetings', requireAdmin, ...meetingChain, handleValidationErrors, (req, res) => {
  // Values already trimmed + length-checked by chain
  const meeting = meetings.create({
    month_year: req.body.month_year,
    meetup_event_url: req.body.meetup_event_url || null,
    meeting_time: req.body.meeting_time || null,
    location_text: req.body.location_text || null,
  });

  if (req.body.topic) {
    meetings.updateTopic(meeting.id, req.body.topic);
  }

  res.status(201).json({ success: true, meeting: meetings.getById(meeting.id) });
});

// ---------------------------------------------------------------------------
// Update meeting details
// PUT /api/admin/meetings/:id
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id', requireAdmin, ...meetingChain, handleValidationErrors, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const existing = meetings.getById(id);
  if (!existing) return res.status(404).json({ error: 'Meeting not found.' });

  // Values already trimmed + length-checked by chain
  const meeting = meetings.update(id, {
    month_year: req.body.month_year || existing.month_year,
    meetup_event_url: req.body.meetup_event_url || null,
    meeting_time: req.body.meeting_time || null,
    location_text: req.body.location_text || null,
  });

  // Topic lives on the meeting (always available, even before a pick exists).
  // Mirror to the linked pick when one exists so book-detail views stay in sync.
  if (typeof req.body.topic !== 'undefined') {
    const updated = meetings.updateTopic(id, req.body.topic);
    if (updated.monthly_pick_id) {
      picksService.updateTopic(updated.monthly_pick_id, req.body.topic);
    }
  }

  res.json({ success: true, meeting: meetings.getById(id) });
});

// ---------------------------------------------------------------------------
// Advance meeting status (lifecycle owned by picks service)
// PUT /api/admin/meetings/:id/status
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id/status', requireAdmin, ...meetingStatusChain, handleValidationErrors, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const newStatus = req.body.status; // already trimmed + validated by chain

  // Capture old status before advancing (for SSE broadcast logic)
  const oldMeeting = meetings.getById(id);
  const result = picksService.advanceMeetingStatus(id, newStatus);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  // Notify SSE clients when voting closes or pick finishes
  if (oldMeeting && oldMeeting.status === 'voting' && newStatus === 'upcoming') {
    broadcastStatusChange(id, 'votingClosed');
  }
  if (newStatus === 'results') {
    broadcastStatusChange(id, 'results');
  }

  analytics.track(req.user.id, 'meeting_status_changed', { meetingId: id, from: oldMeeting?.status, to: newStatus });
  res.json({ success: true, meeting: result.meeting });
});

// ---------------------------------------------------------------------------
// Force-set meeting status (admin override, bypasses transition validation)
// PUT /api/admin/meetings/:id/force-status
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id/force-status', requireAdmin, ...meetingStatusChain, handleValidationErrors, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const newStatus = req.body.status; // already trimmed + validated by chain

  const meeting = meetings.getById(id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  if (meeting.status === newStatus) {
    return res.status(400).json({ error: 'Meeting is already in that status.' });
  }

  meetings.forceStatus(id, newStatus);

  // Sync linked pick if one exists
  if (meeting.monthly_pick_id) {
    picksService.advanceStatus(meeting.monthly_pick_id, newStatus);
  }

  // Notify SSE clients when status changes to results
  if (newStatus === 'results') {
    broadcastStatusChange(id, 'results');
  }

  const updated = meetings.getById(id);
  res.json({ success: true, meeting: updated });
});

// ---------------------------------------------------------------------------
// Admin-add nominee
// POST /api/admin/meetings/:id/nominees
// ---------------------------------------------------------------------------
router.post('/admin/meetings/:id/nominees', requireAdmin, ...nominationChain, handleValidationErrors, (req, res) => {
  const meetingId = parseInt(req.params.id, 10);
  if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const meeting = meetings.getById(meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  const title = req.body.title; // already trimmed + length-checked by chain
  const author = req.body.author;

  // Find or create the book (reuses Google Books service)
  const metadata = req.body._metadata || {};
  const book = findOrCreateBook(title, author, metadata);

  meetings.addNominee(meetingId, book.id);
  broadcastAdminMeetingNominees(meetingId);
  broadcastPublicNominees(meetingId);
  broadcastHomeActivity();

  res.status(201).json({ success: true, book: { id: book.id, title: book.title, author: book.author } });
});

// ---------------------------------------------------------------------------
// Remove nominee
// DELETE /api/admin/meetings/:id/nominees/:bookId
// ---------------------------------------------------------------------------
router.delete('/admin/meetings/:id/nominees/:bookId', requireAdmin, (req, res) => {
  const meetingId = parseInt(req.params.id, 10);
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(meetingId) || isNaN(bookId)) {
    return res.status(400).json({ error: 'Invalid IDs.' });
  }

  meetings.removeNominee(meetingId, bookId);
  broadcastAdminMeetingNominees(meetingId);
  broadcastPublicNominees(meetingId);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Edit nominee (update book title/author + nomination reason)
// PUT /api/admin/meetings/:id/nominees/:bookId
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id/nominees/:bookId', requireAdmin, (req, res) => {
  const meetingId = parseInt(req.params.id, 10);
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(meetingId) || isNaN(bookId)) {
    return res.status(400).json({ error: 'Invalid IDs.' });
  }

  const { title, author, reason } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author are required.' });
  }

  const trimTitle = String(title).trim().slice(0, 200);
  const trimAuthor = String(author).trim().slice(0, 200);
  const trimReason = reason ? String(reason).trim().slice(0, 500) : null;

  // Update book title, author, and slugs
  db.prepare(`
    UPDATE books SET title = ?, author = ?, title_slug = ?, author_slug = ?
    WHERE id = ?
  `).run(trimTitle, trimAuthor, slugify(trimTitle), slugify(trimAuthor), bookId);

  // Update nomination reason (if a nomination row exists)
  db.prepare(`
    UPDATE nominations SET reason = ?
    WHERE meeting_id = ? AND book_id = ?
  `).run(trimReason, meetingId, bookId);

  broadcastAdminMeetingNominees(meetingId);
  broadcastPublicNominees(meetingId);

  res.json({ success: true, book: { id: bookId, title: trimTitle, author: trimAuthor, reason: trimReason } });
});

// ---------------------------------------------------------------------------
// Import historical results (backfill from StrawPoll screenshots)
// POST /api/admin/meetings/:id/import-results
// ---------------------------------------------------------------------------
router.post('/admin/meetings/:id/import-results', requireAdmin, (req, res) => {
  const meetingId = parseInt(req.params.id, 10);
  if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const meeting = meetings.getById(meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  const { rankings, voteCount } = req.body;
  if (!Array.isArray(rankings) || rankings.length === 0) {
    return res.status(400).json({ error: 'At least one ranking entry is required.' });
  }

  const totalVotes = parseInt(voteCount, 10) || 0;

  // Build results: find/create each book, add as nominee, compute percentages
  const sortedRankings = rankings
    .map(r => ({
      title: String(r.title || '').trim(),
      author: String(r.author || '').trim(),
      points: parseInt(r.points, 10) || 0,
    }))
    .filter(r => r.title && r.author)
    .sort((a, b) => b.points - a.points);

  if (sortedRankings.length === 0) {
    return res.status(400).json({ error: 'No valid ranking entries found.' });
  }

  const maxPoints = sortedRankings[0].points;

  const resultsRankings = sortedRankings.map((r, i) => {
    const book = findOrCreateBook(r.title, r.author);
    // Add as nominee (idempotent via INSERT OR IGNORE)
    meetings.addNominee(meetingId, book.id);
    return {
      book_id: book.id,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url || null,
      author_slug: book.author_slug,
      title_slug: book.title_slug,
      points: r.points,
      rank: i + 1,
      pct: maxPoints > 0 ? Math.round((r.points / maxPoints) * 100) : 0,
      nominator_name: null,
    };
  });

  const resultsJson = JSON.stringify({
    rankings: resultsRankings,
    voteCount: totalVotes,
    maxPoints,
  });

  // Save to both meeting and pick
  db.prepare('UPDATE meetings SET vote_results_json = ?, winning_book_id = ? WHERE id = ?')
    .run(resultsJson, resultsRankings[0].book_id, meetingId);

  const picksService = require('../services/monthly-picks');
  const pick = picksService.getByMonthYear(meeting.month_year);
  if (pick) {
    db.prepare('UPDATE monthly_picks SET vote_results_json = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(resultsJson, pick.id);
  }

  res.json({ success: true, resultsCount: resultsRankings.length });
});

// ---------------------------------------------------------------------------
// Download bulk import template JSON
// GET /api/admin/import-results/template
// ---------------------------------------------------------------------------
router.get('/admin/import-results/template', requireAdmin, (req, res) => {
  const allMeetings = meetings.getAll();
  const finishedMeetings = allMeetings
    .filter(m => m.status === 'results')
    .sort((a, b) => a.month_year.localeCompare(b.month_year));

  const template = finishedMeetings.map(m => ({
    monthYear: m.month_year,
    title: m.book_title || '',
    author: m.book_author || '',
    pollResults: [],
    totalVotes: 0,
  }));

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="sfbc-results-template.json"');
  res.json(template);
});

// ---------------------------------------------------------------------------
// Preview bulk import (dry-run validation)
// POST /api/admin/import-results/preview
// ---------------------------------------------------------------------------
router.post('/admin/import-results/preview', requireAdmin, (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Request body must be a JSON array.' });
  }

  const picksService = require('../services/monthly-picks');
  const preview = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const monthYear = String(entry.monthYear || '').trim();
    const title = String(entry.title || '').trim();
    const author = String(entry.author || '').trim();

    // Skip entries without pollResults
    if (!entry.pollResults || !Array.isArray(entry.pollResults) || entry.pollResults.length === 0) {
      continue;
    }

    // Validate monthYear format
    if (!/^\d{4}-\d{2}$/.test(monthYear)) {
      preview.push({ monthYear, title, author, status: 'error', reason: 'Invalid monthYear format. Expected YYYY-MM.' });
      continue;
    }

    // Check meeting exists
    const meeting = meetings.getByMonthYear(monthYear);
    if (!meeting) {
      preview.push({ monthYear, title, author, status: 'error', reason: 'No meeting found for ' + monthYear + '.' });
      continue;
    }

    // Check for existing results
    const pick = picksService.getByMonthYear(monthYear);
    const hasExisting = !!(meeting.vote_results_json || (pick && pick.vote_results_json));

    // Validate pollResults entries
    const validRankings = entry.pollResults
      .map(r => ({ title: String(r.title || '').trim(), author: String(r.author || '').trim(), points: parseInt(r.points, 10) || 0 }))
      .filter(r => r.title && r.author);

    if (validRankings.length === 0) {
      preview.push({ monthYear, title, author, status: 'error', reason: 'No valid entries in pollResults (need title + author).' });
      continue;
    }

    preview.push({
      monthYear, title, author,
      status: hasExisting ? 'overwrite' : 'import',
      reason: hasExisting ? 'Will overwrite existing results.' : null,
      rankingsCount: validRankings.length,
      totalVotes: parseInt(entry.totalVotes, 10) || 0,
    });
  }

  res.json({
    success: true,
    preview,
    summary: {
      total: preview.length,
      toImport: preview.filter(p => p.status === 'import').length,
      toOverwrite: preview.filter(p => p.status === 'overwrite').length,
      errors: preview.filter(p => p.status === 'error').length,
    },
  });
});

// ---------------------------------------------------------------------------
// Commit bulk import (atomic write)
// POST /api/admin/import-results/commit
// ---------------------------------------------------------------------------
router.post('/admin/import-results/commit', requireAdmin, (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Request body must be a JSON array.' });
  }

  const picksService = require('../services/monthly-picks');
  const results = [];
  let imported = 0;
  let overwritten = 0;
  let skipped = 0;
  let errors = 0;

  const importAll = db.transaction(() => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const monthYear = String(entry.monthYear || '').trim();

      // Skip entries without pollResults
      if (!entry.pollResults || !Array.isArray(entry.pollResults) || entry.pollResults.length === 0) {
        skipped++;
        continue;
      }

      if (!/^\d{4}-\d{2}$/.test(monthYear)) {
        errors++;
        results.push({ monthYear, status: 'error', reason: 'Invalid monthYear format.' });
        continue;
      }

      const meeting = meetings.getByMonthYear(monthYear);
      if (!meeting) {
        errors++;
        results.push({ monthYear, status: 'error', reason: 'Meeting not found.' });
        continue;
      }

      const validRankings = entry.pollResults
        .map(r => ({ title: String(r.title || '').trim(), author: String(r.author || '').trim(), points: parseInt(r.points, 10) || 0 }))
        .filter(r => r.title && r.author)
        .sort((a, b) => b.points - a.points);

      if (validRankings.length === 0) {
        errors++;
        results.push({ monthYear, status: 'error', reason: 'No valid pollResults entries.' });
        continue;
      }

      const totalVotes = parseInt(entry.totalVotes, 10) || 0;
      const maxPoints = validRankings[0].points;

      // Check if overwrite
      const pick = picksService.getByMonthYear(monthYear);
      const hadExisting = !!(meeting.vote_results_json || (pick && pick.vote_results_json));

      // Build rankings with book resolution
      const resultsRankings = validRankings.map((r, idx) => {
        const book = findOrCreateBook(r.title, r.author);
        meetings.addNominee(meeting.id, book.id);
        return {
          book_id: book.id,
          title: book.title,
          author: book.author,
          cover_url: book.cover_url || null,
          author_slug: book.author_slug,
          title_slug: book.title_slug,
          points: r.points,
          rank: idx + 1,
          pct: maxPoints > 0 ? Math.round((r.points / maxPoints) * 100) : 0,
          nominator_name: null,
        };
      });

      const resultsJson = JSON.stringify({
        rankings: resultsRankings,
        voteCount: totalVotes,
        maxPoints,
      });

      // Save to meeting
      db.prepare('UPDATE meetings SET vote_results_json = ?, winning_book_id = ? WHERE id = ?')
        .run(resultsJson, resultsRankings[0].book_id, meeting.id);

      // Save to pick
      if (pick) {
        db.prepare("UPDATE monthly_picks SET vote_results_json = ?, updated_at = datetime('now') WHERE id = ?")
          .run(resultsJson, pick.id);
      }

      if (hadExisting) {
        overwritten++;
        results.push({ monthYear, status: 'overwritten', count: resultsRankings.length });
      } else {
        imported++;
        results.push({ monthYear, status: 'imported', count: resultsRankings.length });
      }
    }
  });

  try {
    importAll();
  } catch (err) {
    return res.status(500).json({
      error: 'Import failed. No changes were made. Error: ' + (err.message || 'Unknown error'),
    });
  }

  res.json({ success: true, imported, overwritten, skipped, errors, results });
});

// ---------------------------------------------------------------------------
// Delete meeting (super-admin only)
// DELETE /api/admin/meetings/:id
// ---------------------------------------------------------------------------
router.delete('/admin/meetings/:id', requireAdmin, (req, res) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Only the super-admin can delete meetings.' });
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const existing = meetings.getById(id);
  if (!existing) return res.status(404).json({ error: 'Meeting not found.' });

  meetings.deleteById(id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Delete user (admin only, cannot delete admins)
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------
router.delete('/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  if (target.role === 'admin') {
    return res.status(403).json({ error: 'Cannot delete an admin user.' });
  }

  // Delete user's reviews, then the user
  db.transaction(() => {
    db.prepare('DELETE FROM reviews WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Promote / demote user role (admin only, cannot demote self)
// PUT /api/admin/users/:id/role
// ---------------------------------------------------------------------------
router.put('/admin/users/:id/role', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const newRole = (req.body.role || '').trim();
  if (newRole !== 'admin' && newRole !== 'member') {
    return res.status(400).json({ error: 'Role must be "admin" or "member".' });
  }

  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  // Cannot demote yourself
  if (id === req.user.id && newRole !== 'admin') {
    return res.status(403).json({ error: 'You cannot demote yourself.' });
  }

  if (target.role === newRole) {
    return res.json({ success: true, message: 'Role unchanged.' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, id);
  res.json({ success: true, role: newRole });
});

// ---------------------------------------------------------------------------
// Send magic link to a user (admin action)
// POST /api/admin/users/:id/send-magic-link
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const { sendMagicLink } = require('../services/email');

const insertMagicToken = db.prepare(
  "INSERT INTO magic_link_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))"
);

router.post('/admin/users/:id/send-magic-link', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID.' });

  const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const token = crypto.randomBytes(32).toString('hex');
  insertMagicToken.run(token, target.id);

  try {
    await sendMagicLink(target.email, token);
    res.json({ success: true, message: `Magic link sent to ${target.email}` });
  } catch (err) {
    console.error('Failed to send magic link:', err);
    res.status(500).json({ error: 'Failed to send email. Check server logs.' });
  }
});

// ---------------------------------------------------------------------------
// Delete review (admin only)
// DELETE /api/admin/reviews/:id
// ---------------------------------------------------------------------------
router.delete('/admin/reviews/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid review ID.' });

  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(id);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Replace book cover (admin only)
// PUT /api/admin/books/:id/cover
// ---------------------------------------------------------------------------
router.put('/admin/books/:id/cover', requireAdmin, async (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const { googleBooksId } = req.body;
  if (!googleBooksId) return res.status(400).json({ error: 'Google Books ID is required.' });

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  try {
    const imageUrl = `https://books.google.com/books/content?id=${googleBooksId}&printsec=frontcover&img=1&zoom=0&source=gbs_api`;
    const filename = `${book.author_slug}_${book.title_slug}.jpg`;
    const localPath = await downloadCover(imageUrl, filename);

    db.prepare('UPDATE books SET cover_url = ?, google_books_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(localPath, googleBooksId, bookId);

    res.json({ success: true, cover_url: localPath });
  } catch (err) {
    console.error('Cover download error:', err.message);
    res.status(500).json({ error: 'Failed to download cover: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
// Events CRUD on picks (admin)
// ---------------------------------------------------------------------------

// POST /api/admin/picks/:pickId/events — create event
router.post('/admin/picks/:pickId/events', requireAdmin, (req, res) => {
  const pickId = parseInt(req.params.pickId, 10);
  if (isNaN(pickId)) return res.status(400).json({ error: 'Invalid pick ID.' });

  const pick = picksService.getById(pickId);
  if (!pick) return res.status(404).json({ error: 'Pick not found.' });

  const { meeting_time, location_text, meetup_event_url } = req.body;
  const event = picksService.createEvent(pickId, { meeting_time, location_text, meetup_event_url });
  res.json({ success: true, event });
});

// PUT /api/admin/picks/:pickId/events/:eventId — update event
router.put('/admin/picks/:pickId/events/:eventId', requireAdmin, (req, res) => {
  const pickId = parseInt(req.params.pickId, 10);
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(pickId) || isNaN(eventId)) return res.status(400).json({ error: 'Invalid ID.' });

  const { meeting_time, location_text, meetup_event_url } = req.body;
  const event = picksService.updateEvent(pickId, eventId, { meeting_time, location_text, meetup_event_url });
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({ success: true, event });
});

// DELETE /api/admin/picks/:pickId/events/:eventId — delete event
router.delete('/admin/picks/:pickId/events/:eventId', requireAdmin, (req, res) => {
  const pickId = parseInt(req.params.pickId, 10);
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(pickId) || isNaN(eventId)) return res.status(400).json({ error: 'Invalid ID.' });

  const deleted = picksService.deleteEvent(pickId, eventId);
  if (!deleted) return res.status(404).json({ error: 'Event not found.' });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Announcements (admin)
// ---------------------------------------------------------------------------
const announcementsService = require('../services/announcements');

// POST /api/admin/announcements
router.post('/admin/announcements', requireAdmin, ...announcementChain, handleValidationErrors, (req, res) => {
  const title = req.body.title; // already trimmed + length-checked by chain
  const type = (req.body.type || 'info').trim();
  const body = req.body.body || null; // already trimmed + length-checked by chain

  // Normalize datetime-local format (2026-02-28T15:00) to SQLite format (2026-02-28 15:00:00)
  const rawExpiry = (req.body.expires_at || '').trim() || null;
  const expiresAt = rawExpiry ? rawExpiry.replace('T', ' ').replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/, '$1:00') : null;

  const result = announcementsService.create({
    type,
    title,
    body,
    createdBy: req.user.id,
    expiresAt,
  });

  broadcastHomeAnnouncements();
  res.status(201).json({ success: true, id: result.id });
});

// PUT /api/admin/announcements/:id/deactivate
router.put('/admin/announcements/:id/deactivate', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const existing = announcementsService.getById(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  announcementsService.deactivate(id);
  broadcastHomeAnnouncements();
  res.json({ success: true });
});

// PUT /api/admin/announcements/:id/activate
router.put('/admin/announcements/:id/activate', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const existing = announcementsService.getById(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  announcementsService.activate(id);
  broadcastHomeAnnouncements();
  res.json({ success: true });
});

// DELETE /api/admin/announcements/:id
router.delete('/admin/announcements/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const existing = announcementsService.getById(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  announcementsService.deleteById(id);
  broadcastHomeAnnouncements();
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Site settings
// PUT /api/admin/settings
// ---------------------------------------------------------------------------
router.put('/admin/settings', requireAdmin, (req, res) => {
  const { library_url } = req.body;

  if (library_url !== undefined) {
    const val = (library_url || '').trim();
    if (val) {
      db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run('library_url', val);
    } else {
      db.prepare('DELETE FROM site_settings WHERE key = ?').run('library_url');
    }
  }

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Create review
// POST /api/books/:bookId/reviews
// ---------------------------------------------------------------------------
const reviewsService = require('../services/reviews');
const reactionsService = require('../services/reactions');
const repliesService = require('../services/replies');

// ---------------------------------------------------------------------------
// Toggle emoji reaction on a review
// POST /api/reviews/:reviewId/reactions
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Who reacted with a specific emoji on a review
// GET /api/reviews/:reviewId/reactions/:emoji
// ---------------------------------------------------------------------------
router.get('/reviews/:reviewId/reactions/:emoji', (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID.' });

  const emoji = decodeURIComponent(req.params.emoji);

  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  const reactors = reactionsService.getReactorsForEmoji(reviewId, emoji);
  res.json(reactors);
});

router.post('/reviews/:reviewId/reactions', requireMember, ...emojiChain, handleValidationErrors, (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID.' });

  const emoji = req.body.emoji; // already trimmed + validated by chain

  // Verify review exists
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  const result = reactionsService.toggleReaction(reviewId, req.user.id, emoji);
  broadcastHomeActivity();
  if (result.active) analytics.track(req.user.id, 'reaction_added', { reviewId, emoji });
  res.json(result);
});

router.post('/books/:bookId/reviews', requireMember, ...reviewChain, handleValidationErrors, (req, res) => {
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  const grade = req.body.grade; // already trimmed + required by chain
  const body = req.body.body || null; // already trimmed + length-checked by chain

  // Validate grade exists in grade_weights
  const validGrade = db.prepare('SELECT grade FROM grade_weights WHERE grade = ?').get(grade);
  if (!validGrade) return res.status(400).json({ error: 'Invalid grade.' });

  // Check for existing review (UNIQUE constraint)
  const existing = reviewsService.getByBookAndUser(bookId, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You already have a review for this book. Use PUT to update it.' });
  }

  const hasSpoilers = !!req.body.has_spoilers;
  const didFinish = req.body.did_finish !== undefined ? !!req.body.did_finish : true;
  reviewsService.create(bookId, req.user.id, grade, body, hasSpoilers, didFinish);
  broadcastHomeActivity();
  analytics.track(req.user.id, 'review_submitted', { bookId, grade, hasSpoiler: hasSpoilers, didFinish });
  res.status(201).json({ success: true });
});

// ---------------------------------------------------------------------------
// Update review
// PUT /api/books/:bookId/reviews
// ---------------------------------------------------------------------------
router.put('/books/:bookId/reviews', requireMember, ...reviewChain, handleValidationErrors, (req, res) => {
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const existing = reviewsService.getByBookAndUser(bookId, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'No review found to update.' });
  }

  const grade = req.body.grade; // already trimmed + required by chain
  const body = req.body.body || null; // already trimmed + length-checked by chain

  const validGrade = db.prepare('SELECT grade FROM grade_weights WHERE grade = ?').get(grade);
  if (!validGrade) return res.status(400).json({ error: 'Invalid grade.' });

  const hasSpoilers = !!req.body.has_spoilers;
  const didFinish = req.body.did_finish !== undefined ? !!req.body.did_finish : true;
  reviewsService.update(bookId, req.user.id, grade, body, hasSpoilers, didFinish);
  analytics.track(req.user.id, 'review_updated', { bookId, grade, hasSpoiler: hasSpoilers, didFinish });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Delete review
// DELETE /api/books/:bookId/reviews
// ---------------------------------------------------------------------------
router.delete('/books/:bookId/reviews', requireMember, (req, res) => {
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const existing = reviewsService.getByBookAndUser(bookId, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'No review found to delete.' });
  }

  reviewsService.deleteByBookAndUser(bookId, req.user.id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Review Replies — flat replies under reviews
// POST   /api/reviews/:reviewId/replies       → create
// PUT    /api/replies/:replyId                 → update (author only)
// DELETE /api/replies/:replyId                 → delete (author only)
// ---------------------------------------------------------------------------

const replyChain = sanitizeTextChain('body', {
  max: 2000,
  required: true,
  label: 'Reply',
});

router.post('/reviews/:reviewId/replies', requireMember, ...replyChain, handleValidationErrors, (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID.' });

  // Verify the review exists
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  const replyBody = req.body.body;
  const newId = repliesService.create(reviewId, req.user.id, replyBody);
  broadcastHomeActivity();
  analytics.track(req.user.id, 'reply_created', { reviewId });

  // Return the newly created reply so the client can render it immediately
  const reply = repliesService.getById(newId);
  res.status(201).json({
    success: true,
    reply: {
      id: reply.id,
      review_id: reply.review_id,
      user_id: reply.user_id,
      body_markdown: reply.body_markdown,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      display_name: req.user.display_name,
      avatar_style: req.user.avatar_style,
      user_slug: req.user.user_slug,
      email: req.user.email,
    },
  });
});

router.put('/replies/:replyId', requireMember, ...replyChain, handleValidationErrors, (req, res) => {
  const replyId = parseInt(req.params.replyId, 10);
  if (isNaN(replyId)) return res.status(400).json({ error: 'Invalid reply ID.' });

  const reply = repliesService.getById(replyId);
  if (!reply) return res.status(404).json({ error: 'Reply not found.' });

  // Only the author can edit
  if (reply.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own replies.' });
  }

  repliesService.update(replyId, req.body.body);
  res.json({ success: true });
});

router.delete('/replies/:replyId', requireMember, (req, res) => {
  const replyId = parseInt(req.params.replyId, 10);
  if (isNaN(replyId)) return res.status(400).json({ error: 'Invalid reply ID.' });

  const reply = repliesService.getById(replyId);
  if (!reply) return res.status(404).json({ error: 'Reply not found.' });

  // Only the author can delete
  if (reply.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own replies.' });
  }

  repliesService.remove(replyId);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Book search (for live cover preview)
// GET /api/books/search?title=...&author=...
// ---------------------------------------------------------------------------
router.get('/books/search', async (req, res) => {
  const { title, author } = req.query;

  if (!title || !author || title.length < 2 || author.length < 2) {
    return res.json({ found: false });
  }

  try {
    const result = await searchGoogleBooks(title, author);
    if (!result) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      title: result.title,
      author: result.author,
      coverUrl: result.coverUrl,
      year: result.publicationYear,
      googleBooksId: result.googleBooksId || null,
    });
  } catch {
    res.json({ found: false });
  }
});

// ---------------------------------------------------------------------------
// Multi-result book search (for nomination search bar)
// GET /api/books/search-multi?q=...&maxResults=5
// ---------------------------------------------------------------------------
router.get('/books/search-multi', async (req, res) => {
  const q = (req.query.q || '').trim();
  const max = Math.min(parseInt(req.query.maxResults, 10) || 5, 10);

  if (q.length < 3) {
    return res.json({ results: [] });
  }

  try {
    const results = await searchGoogleBooksMulti(q, max);
    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
});

// ---------------------------------------------------------------------------
// Submit nomination
// POST /api/meetings/:meetingId/nominations
// ---------------------------------------------------------------------------
const insertNomination = db.prepare(`
  INSERT INTO nominations (meeting_id, book_id, submitted_fingerprint, reason, user_id)
  VALUES (?, ?, ?, ?, ?)
`);

const insertNominee = db.prepare(`
  INSERT OR IGNORE INTO meeting_nominees (meeting_id, book_id, source)
  VALUES (?, ?, 'nomination')
`);

router.post('/meetings/:meetingId/nominations', submissionLimiter, ...nominationChain, (req, res, next) => {
  // Custom validation handler — redirects for form submissions, JSON for API
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0].msg;
    const wantsJson = req.get('Accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(400).json({ error: firstError });
    }
    // Form fallback: need meeting to build redirect URL
    const meetingId = parseInt(req.params.meetingId, 10);
    const meeting = !isNaN(meetingId)
      ? db.prepare('SELECT month_year FROM meetings WHERE id = ?').get(meetingId)
      : null;
    if (meeting) {
      return res.redirect(`/nominate/${monthYearSlug(meeting.month_year)}`);
    }
    return res.status(400).json({ error: firstError });
  }
  next();
}, (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) {
    return res.status(400).json({ error: 'Invalid meeting ID.' });
  }

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found.' });
  }

  if (meeting.status !== 'nominations') {
    return res.status(403).json({ error: 'Nominations are not open for this meeting.' });
  }

  const title = req.body.title; // already trimmed + length-checked by chain
  const author = req.body.author;
  const reason = req.body.reason || null;

  // Derive fingerprint for this browser + meeting
  const fingerprint = getFingerprint(req, res, meetingId);

  // Check for duplicate nomination
  const existing = db.prepare(
    'SELECT id FROM nominations WHERE meeting_id = ? AND submitted_fingerprint = ?'
  ).get(meetingId, fingerprint);

  // Find or create the book
  const metadata = req.body._metadata || {};
  const book = findOrCreateBook(title, author, metadata);

  // Block nominations for books the club has already read
  const alreadyRead = db.prepare(`
    SELECT m.month_year FROM meetings m
    WHERE m.winning_book_id = ? AND m.status IN ('reading', 'results')
    LIMIT 1
  `).get(book.id);

  if (alreadyRead) {
    const wantsJson = req.get('Accept')?.includes('application/json');
    const msg = 'The club has already read this book! Try nominating something new.';
    if (wantsJson) {
      return res.status(409).json({ error: msg });
    }
    return res.redirect(`/nominate/${monthYearSlug(meeting.month_year)}`);
  }

  // Get user ID if logged in
  const userId = (req.session && req.session.userId) ? req.session.userId : null;

  // Insert (or replace) nomination + nominee in a transaction
  db.transaction(() => {
    if (existing) {
      // Remove old nomination so the user can re-nominate a different book
      const oldNom = db.prepare(
        'SELECT book_id FROM nominations WHERE id = ?'
      ).get(existing.id);
      db.prepare('DELETE FROM nominations WHERE id = ?').run(existing.id);

      // Only remove the old meeting_nominee if no other nominations reference it
      if (oldNom) {
        const otherNoms = db.prepare(
          'SELECT 1 FROM nominations WHERE meeting_id = ? AND book_id = ?'
        ).get(meetingId, oldNom.book_id);
        if (!otherNoms) {
          db.prepare(
            'DELETE FROM meeting_nominees WHERE meeting_id = ? AND book_id = ?'
          ).run(meetingId, oldNom.book_id);
        }
      }
    }
    insertNomination.run(meetingId, book.id, fingerprint, reason, userId);
    insertNominee.run(meetingId, book.id);
  })();

  broadcastAdminMeetingNominees(meetingId);
  broadcastPublicNominees(meetingId);
  broadcastHomeActivity();
  analytics.track(req.session?.userId || 'anonymous', 'nomination_created', { meetingId, bookTitle: book.title });

  const slug = monthYearSlug(meeting.month_year);
  const wantsJson = req.get('Accept')?.includes('application/json');
  if (wantsJson) {
    return res.status(201).json({
      success: true,
      meetingSlug: slug,
      book: {
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url || null,
      },
    });
  }

  // Non-JS fallback: redirect back to the nomination page (which will show "already nominated")
  res.redirect(`/nominate/${slug}`);
});

// ---------------------------------------------------------------------------
// SSE client pool for home page (announcements + activity feed)
// ---------------------------------------------------------------------------
const activityService = require('../services/activity');
const homeSseClients = new Set();

function broadcastHomeAnnouncements() {
  if (homeSseClients.size === 0) return;
  const announcements = announcementsService.getActive();
  const payload = `event: announcements\ndata: ${JSON.stringify(announcements)}\n\n`;
  for (const client of homeSseClients) {
    client.write(payload);
  }
}

function broadcastHomeActivity() {
  if (homeSseClients.size === 0) return;
  const activity = activityService.getRecentActivity(15);
  const payload = `event: activity\ndata: ${JSON.stringify(activity)}\n\n`;
  for (const client of homeSseClients) {
    client.write(payload);
  }
}

// ---------------------------------------------------------------------------
// SSE client pool for admin meeting detail (live nominees + vote count)
// ---------------------------------------------------------------------------
const adminMeetingSseClients = new Map(); // meetingId → Set<res>

function broadcastAdminMeetingNominees(meetingId) {
  const clients = adminMeetingSseClients.get(meetingId);
  if (!clients || clients.size === 0) return;

  const nominees = meetings.getNominees(meetingId);
  const payload = `event: nominees\ndata: ${JSON.stringify(nominees)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function broadcastAdminMeetingVoteCount(meetingId) {
  const clients = adminMeetingSseClients.get(meetingId);
  if (!clients || clients.size === 0) return;

  const { getVoteCount } = require('../services/voting');
  const voteCount = getVoteCount(meetingId);
  const payload = `event: voteCount\ndata: ${JSON.stringify({ voteCount })}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

// ---------------------------------------------------------------------------
// SSE client pool for public nominations page (live nominee list)
// ---------------------------------------------------------------------------
const publicNominationSseClients = new Map(); // meetingId → Set<res>

function broadcastPublicNominees(meetingId) {
  const clients = publicNominationSseClients.get(meetingId);
  if (!clients || clients.size === 0) return;

  const nominees = meetings.getNominees(meetingId);
  const payload = `event: nominees\ndata: ${JSON.stringify(nominees)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

// ---------------------------------------------------------------------------
// SSE client pool for live results
// ---------------------------------------------------------------------------
const sseClients = new Map(); // meetingId → Set<res>

function broadcastResults(meetingId) {
  const clients = sseClients.get(meetingId);
  if (!clients || clients.size === 0) return;

  const data = calculateResults(meetingId);
  const payload = `data: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

function broadcastStatusChange(meetingId, status) {
  const clients = sseClients.get(meetingId);
  if (!clients || clients.size === 0) return;

  const payload = `event: status\ndata: ${JSON.stringify({ status })}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

// ---------------------------------------------------------------------------
// Submit vote
// POST /api/meetings/:meetingId/votes
// ---------------------------------------------------------------------------
const insertVote = db.prepare(`
  INSERT INTO votes (meeting_id, ranking_json, submitted_fingerprint)
  VALUES (?, ?, ?)
`);

router.post('/meetings/:meetingId/votes', submissionLimiter, (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) {
    return res.status(400).json({ error: 'Invalid meeting ID.' });
  }

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found.' });
  }

  if (meeting.status !== 'voting') {
    return res.status(403).json({ error: 'Voting is not open for this meeting.' });
  }

  // Derive fingerprint
  const fingerprint = getFingerprint(req, res, meetingId);

  const slug = monthYearSlug(meeting.month_year);

  // Already voted?
  if (hasVoted(meetingId, fingerprint)) {
    const wantsJson = req.get('Accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(409).json({ error: 'You have already voted in this meeting.' });
    }
    return res.redirect('/results/' + slug);
  }

  // Parse ranking from multiple possible input formats
  let ranking;
  const nominees = getNomineesForBallot(meetingId);
  const validBookIds = new Set(nominees.map(n => n.book_id));

  if (req.body.ranking && Array.isArray(req.body.ranking)) {
    // JSON array from fetch submission
    ranking = req.body.ranking.map(Number);
  } else if (typeof req.body.ranking === 'string' && req.body.ranking.includes(',')) {
    // Comma-separated string from hidden input (no-JS fallback)
    ranking = req.body.ranking.split(',').map(Number);
  } else {
    // rank_<bookId> select fields (noscript fallback)
    const rankEntries = [];
    for (const key of Object.keys(req.body)) {
      if (key.startsWith('rank_')) {
        const bookId = parseInt(key.slice(5), 10);
        const rank = parseInt(req.body[key], 10);
        if (!isNaN(bookId) && !isNaN(rank)) {
          rankEntries.push({ bookId, rank });
        }
      }
    }

    if (rankEntries.length > 0) {
      rankEntries.sort((a, b) => a.rank - b.rank);
      ranking = rankEntries.map(e => e.bookId);
    }
  }

  // Validate ranking
  if (!ranking || !Array.isArray(ranking) || ranking.length !== validBookIds.size) {
    const wantsJson = req.get('Accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(400).json({ error: 'Ranking must include all nominees exactly once.' });
    }
    return res.redirect('/vote/' + slug);
  }

  // Check all IDs are valid and no duplicates
  const seen = new Set();
  for (const id of ranking) {
    if (!validBookIds.has(id) || seen.has(id)) {
      const wantsJson = req.get('Accept')?.includes('application/json');
      if (wantsJson) {
        return res.status(400).json({ error: 'Ranking contains invalid or duplicate book IDs.' });
      }
      return res.redirect('/vote/' + slug);
    }
    seen.add(id);
  }

  // Store the vote
  insertVote.run(meetingId, JSON.stringify(ranking), fingerprint);

  // Broadcast updated results to SSE clients
  broadcastResults(meetingId);
  broadcastAdminMeetingVoteCount(meetingId);
  analytics.track(req.session?.userId || fingerprint, 'vote_cast', { meetingId });

  const wantsJson = req.get('Accept')?.includes('application/json');
  if (wantsJson) {
    return res.status(201).json({ success: true, redirect: '/results/' + slug });
  }

  res.redirect('/results/' + slug);
});

// ---------------------------------------------------------------------------
// SSE stream for live results
// GET /api/meetings/:meetingId/results/stream
// ---------------------------------------------------------------------------
router.get('/meetings/:meetingId/results/stream', (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) {
    return res.status(400).end();
  }

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting || (meeting.status !== 'voting' && meeting.status !== 'results')) {
    return res.status(404).end();
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });

  // Send initial results immediately
  const initial = calculateResults(meetingId);
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  // Register this client
  if (!sseClients.has(meetingId)) {
    sseClients.set(meetingId, new Set());
  }
  sseClients.get(meetingId).add(res);

  // Heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(meetingId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(meetingId);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SSE stream for home page (announcements + activity)
// GET /api/home/stream
// ---------------------------------------------------------------------------
router.get('/home/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial state
  const announcements = announcementsService.getActive();
  res.write(`event: announcements\ndata: ${JSON.stringify(announcements)}\n\n`);

  const activity = activityService.getRecentActivity(15);
  res.write(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`);

  // Register client
  homeSseClients.add(res);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    homeSseClients.delete(res);
  });
});

// ---------------------------------------------------------------------------
// SSE stream for admin meeting detail (live nominees + vote count)
// GET /api/admin/meetings/:meetingId/stream
// ---------------------------------------------------------------------------
router.get('/admin/meetings/:meetingId/stream', requireAdmin, (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) return res.status(400).end();

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) return res.status(404).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial nominees
  const nominees = meetings.getNominees(meetingId);
  res.write(`event: nominees\ndata: ${JSON.stringify(nominees)}\n\n`);

  // Send initial vote count
  const { getVoteCount } = require('../services/voting');
  const voteCount = getVoteCount(meetingId);
  res.write(`event: voteCount\ndata: ${JSON.stringify({ voteCount })}\n\n`);

  // Register client
  if (!adminMeetingSseClients.has(meetingId)) {
    adminMeetingSseClients.set(meetingId, new Set());
  }
  adminMeetingSseClients.get(meetingId).add(res);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = adminMeetingSseClients.get(meetingId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        adminMeetingSseClients.delete(meetingId);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SSE stream for public nominations page (live nominee list)
// GET /api/meetings/:meetingId/nominations/stream
// ---------------------------------------------------------------------------
router.get('/meetings/:meetingId/nominations/stream', (req, res) => {
  const meetingId = parseInt(req.params.meetingId, 10);
  if (isNaN(meetingId)) return res.status(400).end();

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting || meeting.status !== 'nominations') {
    return res.status(404).end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial nominees
  const nominees = meetings.getNominees(meetingId);
  res.write(`event: nominees\ndata: ${JSON.stringify(nominees)}\n\n`);

  // Register client
  if (!publicNominationSseClients.has(meetingId)) {
    publicNominationSseClients.set(meetingId, new Set());
  }
  publicNominationSseClients.get(meetingId).add(res);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = publicNominationSseClients.get(meetingId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        publicNominationSseClients.delete(meetingId);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Invites (any member)
// ---------------------------------------------------------------------------

// POST /api/invites — generate an invite link
router.post('/invites', requireMember, (req, res) => {
  const code = crypto.randomBytes(4).toString('hex'); // 8-char hex
  db.prepare('INSERT INTO invites (code, invited_by) VALUES (?, ?)').run(code, req.user.id);
  const url = `${req.protocol}://${req.get('host')}/join/${code}`;
  analytics.track(req.user.id, 'invite_created', { code });
  res.json({ success: true, code, url });
});

// GET /api/invites/mine — list current user's invites
router.get('/invites/mine', requireMember, (req, res) => {
  const invites = db.prepare(
    'SELECT code, use_count, max_uses, created_at FROM invites WHERE invited_by = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json({ invites });
});

module.exports = router;
