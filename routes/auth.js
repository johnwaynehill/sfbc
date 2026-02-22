'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = require('express').Router();
const db = require('../db');
const { sendMagicLink } = require('../services/email');

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const findUserByEmail = db.prepare(
  'SELECT * FROM users WHERE email = ?'
);

const createUser = db.prepare(
  "INSERT INTO users (email, display_name, role) VALUES (?, ?, 'member')"
);

const insertToken = db.prepare(
  "INSERT INTO magic_link_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))"
);

const findValidToken = db.prepare(`
  SELECT t.*, u.id AS uid, u.email, u.display_name, u.role
  FROM magic_link_tokens t
  JOIN users u ON u.id = t.user_id
  WHERE t.token = ? AND t.used_at IS NULL AND t.expires_at > datetime('now')
`);

const markTokenUsed = db.prepare(
  "UPDATE magic_link_tokens SET used_at = datetime('now') WHERE id = ?"
);

// ---------------------------------------------------------------------------
// GET /login — render login form
// ---------------------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }

  res.locals.layout = 'layouts/focus-shell';
  res.render('login', {
    pageTitle: 'Sign In',
    step: 'form',
    email: null,
    error: null,
  });
});

// ---------------------------------------------------------------------------
// POST /auth/send-link — generate token, send email
// ---------------------------------------------------------------------------
router.post('/auth/send-link', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const wantsJson = req.get('Accept')?.includes('application/json');

  if (!email || !email.includes('@')) {
    if (wantsJson) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    res.locals.layout = 'layouts/focus-shell';
    return res.render('login', {
      pageTitle: 'Sign In',
      step: 'form',
      email,
      error: 'Please enter a valid email address.',
    });
  }

  // Find or create the user (auto-register on first login)
  let user = findUserByEmail.get(email);
  if (!user) {
    const displayName = email.split('@')[0];
    createUser.run(email, displayName);
    user = findUserByEmail.get(email);
  }

  // Generate a token
  const token = crypto.randomBytes(32).toString('hex');
  insertToken.run(token, user.id);

  // Send the magic link (async — don't block on failure)
  try {
    await sendMagicLink(email, token);
  } catch (err) {
    console.error('Failed to send magic link:', err);
  }

  // Always show "check your email" (don't reveal if email exists)
  if (wantsJson) {
    return res.json({ success: true, message: 'Check your email for a login link.' });
  }

  res.locals.layout = 'layouts/focus-shell';
  res.render('login', {
    pageTitle: 'Check Your Email',
    step: 'sent',
    email,
    error: null,
  });
});

// ---------------------------------------------------------------------------
// GET /auth/callback?token=xxx — validate token, set session
// ---------------------------------------------------------------------------
router.get('/auth/callback', (req, res) => {
  const { token } = req.query;

  if (!token) {
    res.locals.layout = 'layouts/focus-shell';
    return res.render('login', {
      pageTitle: 'Invalid Link',
      step: 'error',
      email: null,
      error: 'This login link is invalid.',
    });
  }

  const row = findValidToken.get(token);
  if (!row) {
    res.locals.layout = 'layouts/focus-shell';
    return res.render('login', {
      pageTitle: 'Link Expired',
      step: 'error',
      email: null,
      error: 'This login link has expired or has already been used. Please request a new one.',
    });
  }

  // Mark token as used
  markTokenUsed.run(row.id);

  // Set session
  req.session.userId = row.uid;
  req.session.save((err) => {
    if (err) console.error('Session save error:', err);
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/password-login — email + password login
// ---------------------------------------------------------------------------
router.post('/auth/password-login', (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?').get(email);

  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  req.session.save((err) => {
    if (err) console.error('Session save error:', err);
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.json({ success: true, redirect: returnTo });
  });
});

// ---------------------------------------------------------------------------
// GET /auth/logout — destroy session
// ---------------------------------------------------------------------------
router.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
