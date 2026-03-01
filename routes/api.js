const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { slugify } = require('../utils/slug');
const { searchGoogleBooks, findOrCreateBook } = require('../services/books');
const { getFingerprint } = require('../services/fingerprint');
const {
  getNomineesForBallot,
  hasVoted,
  calculateResults,
} = require('../services/voting');
const meetings = require('../services/meetings');
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
// Update display name
// PUT /api/auth/display-name
// ---------------------------------------------------------------------------
router.put('/auth/display-name', requireMember, ...displayNameChain, handleValidationErrors, (req, res) => {
  const name = req.body.display_name; // already trimmed + length-checked by chain

  // Regenerate slug to match the new name
  const base = slugify(name) || 'member';
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM users WHERE user_slug = ? AND id != ?').get(slug, req.user.id)) {
    slug = base + '-' + n++;
  }

  db.prepare('UPDATE users SET display_name = ?, user_slug = ? WHERE id = ?').run(name, slug, req.user.id);
  res.json({ success: true, display_name: name, user_slug: slug });
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

  res.status(201).json({ success: true, meeting });
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

  res.json({ success: true, meeting });
});

// ---------------------------------------------------------------------------
// Advance meeting status
// PUT /api/admin/meetings/:id/status
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id/status', requireAdmin, ...meetingStatusChain, handleValidationErrors, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const newStatus = req.body.status; // already trimmed + validated by chain

  const result = meetings.advanceStatus(id, newStatus);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  // When voting closes, notify all SSE clients so they reload
  if (newStatus === 'results') {
    broadcastStatusChange(id, 'results');
  }

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
  res.json({ success: true });
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

  res.status(201).json({ success: true, id: result.id });
});

// PUT /api/admin/announcements/:id/deactivate
router.put('/admin/announcements/:id/deactivate', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const existing = announcementsService.getById(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  announcementsService.deactivate(id);
  res.json({ success: true });
});

// PUT /api/admin/announcements/:id/activate
router.put('/admin/announcements/:id/activate', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const existing = announcementsService.getById(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  announcementsService.activate(id);
  res.json({ success: true });
});

// DELETE /api/admin/announcements/:id
router.delete('/admin/announcements/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

  const existing = announcementsService.getById(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  announcementsService.deleteById(id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Create review
// POST /api/books/:bookId/reviews
// ---------------------------------------------------------------------------
const reviewsService = require('../services/reviews');
const reactionsService = require('../services/reactions');

// ---------------------------------------------------------------------------
// Toggle emoji reaction on a review
// POST /api/reviews/:reviewId/reactions
// ---------------------------------------------------------------------------
router.post('/reviews/:reviewId/reactions', requireMember, ...emojiChain, handleValidationErrors, (req, res) => {
  const reviewId = parseInt(req.params.reviewId, 10);
  if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID.' });

  const emoji = req.body.emoji; // already trimmed + validated by chain

  // Verify review exists
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found.' });

  const result = reactionsService.toggleReaction(reviewId, req.user.id, emoji);
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
  reviewsService.create(bookId, req.user.id, grade, body, hasSpoilers);
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
  reviewsService.update(bookId, req.user.id, grade, body, hasSpoilers);
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

module.exports = router;
