const router = require('express').Router();
const bcrypt = require('bcryptjs');
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
router.post('/admin/bootstrap', (req, res) => {
  const { bootstrapKey, email, password } = req.body;

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

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')"
  ).run(email.toLowerCase().trim(), hash);

  res.status(201).json({
    message: 'Admin account created successfully.',
    userId: Number(result.lastInsertRowid),
  });
});

// ---------------------------------------------------------------------------
// Admin login
// POST /api/auth/admin-login
// ---------------------------------------------------------------------------
router.post('/auth/admin-login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare(
    "SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = 'admin'"
  ).get(email.toLowerCase().trim());

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
router.put('/auth/display-name', requireMember, (req, res) => {
  const name = (req.body.display_name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Display name is required.' });

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
router.put('/auth/password', requireMember, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

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
router.put('/auth/social-links', requireMember, (req, res) => {
  const goodreads_url = (req.body.goodreads_url || '').trim().slice(0, 500);
  const storygraph_url = (req.body.storygraph_url || '').trim().slice(0, 500);
  const instagram_handle = (req.body.instagram_handle || '').trim().replace(/^@/, '').slice(0, 60);
  const threads_handle = (req.body.threads_handle || '').trim().replace(/^@/, '').slice(0, 60);

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
router.post('/admin/users', requireAdmin, (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = (req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 12);
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
router.post('/admin/meetings', requireAdmin, (req, res) => {
  const month_year = (req.body.month_year || '').trim();
  if (!month_year) {
    return res.status(400).json({ error: 'Month/year is required.' });
  }

  const meeting = meetings.create({
    month_year,
    meetup_event_url: (req.body.meetup_event_url || '').trim() || null,
    meeting_time: (req.body.meeting_time || '').trim() || null,
    location_text: (req.body.location_text || '').trim() || null,
  });

  res.status(201).json({ success: true, meeting });
});

// ---------------------------------------------------------------------------
// Update meeting details
// PUT /api/admin/meetings/:id
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const existing = meetings.getById(id);
  if (!existing) return res.status(404).json({ error: 'Meeting not found.' });

  const meeting = meetings.update(id, {
    month_year: (req.body.month_year || '').trim() || existing.month_year,
    meetup_event_url: (req.body.meetup_event_url || '').trim() || null,
    meeting_time: (req.body.meeting_time || '').trim() || null,
    location_text: (req.body.location_text || '').trim() || null,
  });

  res.json({ success: true, meeting });
});

// ---------------------------------------------------------------------------
// Advance meeting status
// PUT /api/admin/meetings/:id/status
// ---------------------------------------------------------------------------
router.put('/admin/meetings/:id/status', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const newStatus = (req.body.status || '').trim();
  if (!newStatus) return res.status(400).json({ error: 'New status is required.' });

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
router.put('/admin/meetings/:id/force-status', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const newStatus = (req.body.status || '').trim();
  const validStatuses = ['upcoming', 'reading', 'nominations', 'voting', 'results'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

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
router.post('/admin/meetings/:id/nominees', requireAdmin, (req, res) => {
  const meetingId = parseInt(req.params.id, 10);
  if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID.' });

  const meeting = meetings.getById(meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  const title = (req.body.title || '').trim();
  const author = (req.body.author || '').trim();
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author are required.' });
  }

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
// Create review
// POST /api/books/:bookId/reviews
// ---------------------------------------------------------------------------
const reviewsService = require('../services/reviews');

router.post('/books/:bookId/reviews', requireMember, (req, res) => {
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  const grade = (req.body.grade || '').trim();
  const body = (req.body.body || '').trim() || null;

  if (!grade) return res.status(400).json({ error: 'Grade is required.' });

  // Validate grade exists in grade_weights
  const validGrade = db.prepare('SELECT grade FROM grade_weights WHERE grade = ?').get(grade);
  if (!validGrade) return res.status(400).json({ error: 'Invalid grade.' });

  // Check for existing review (UNIQUE constraint)
  const existing = reviewsService.getByBookAndUser(bookId, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You already have a review for this book. Use PUT to update it.' });
  }

  reviewsService.create(bookId, req.user.id, grade, body);
  res.status(201).json({ success: true });
});

// ---------------------------------------------------------------------------
// Update review
// PUT /api/books/:bookId/reviews
// ---------------------------------------------------------------------------
router.put('/books/:bookId/reviews', requireMember, (req, res) => {
  const bookId = parseInt(req.params.bookId, 10);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const existing = reviewsService.getByBookAndUser(bookId, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'No review found to update.' });
  }

  const grade = (req.body.grade || '').trim();
  const body = (req.body.body || '').trim() || null;

  if (!grade) return res.status(400).json({ error: 'Grade is required.' });

  const validGrade = db.prepare('SELECT grade FROM grade_weights WHERE grade = ?').get(grade);
  if (!validGrade) return res.status(400).json({ error: 'Invalid grade.' });

  reviewsService.update(bookId, req.user.id, grade, body);
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

router.post('/meetings/:meetingId/nominations', (req, res) => {
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

  const title = (req.body.title || '').trim();
  const author = (req.body.author || '').trim();
  const reason = (req.body.reason || '').trim().slice(0, 280) || null;

  if (!title || !author) {
    const wantsJson = req.get('Accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(400).json({ error: 'Title and author are required.' });
    }
    return res.redirect(`/nominate/${monthYearSlug(meeting.month_year)}`);
  }

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

router.post('/meetings/:meetingId/votes', (req, res) => {
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
