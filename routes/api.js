const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');

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

module.exports = router;
