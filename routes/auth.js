'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const router = require('express').Router();
const db = require('../db');
const analytics = require('../services/analytics');
const { sendMagicLink } = require('../services/email');
const { emailChain, handleValidationErrors } = require('../middleware/validate');

// ---------------------------------------------------------------------------
// Auth rate limiter — 5 attempts per 15 minutes per IP
// ---------------------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

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

  res.locals.layout = 'layouts/app-shell';
  res.render('login', {
    pageTitle: 'Sign In or Create an Account',
    step: 'form',
    email: null,
    error: null,
    invite: null,
  });
});

// ---------------------------------------------------------------------------
// POST /auth/send-link — generate token, send email
// ---------------------------------------------------------------------------
router.post('/auth/send-link', authLimiter, ...emailChain, async (req, res) => {
  const wantsJson = req.get('Accept')?.includes('application/json');

  // Check validation result — render form for HTML requests, JSON for API
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0].msg;
    if (wantsJson) {
      return res.status(400).json({ error: firstError });
    }
    res.locals.layout = 'layouts/app-shell';
    return res.render('login', {
      pageTitle: 'Sign In or Create an Account',
      step: 'form',
      email: req.body.email || '',
      error: firstError,
      invite: null,
    });
  }

  const email = req.body.email; // already trimmed + lowercased by chain

  // Find or create the user (auto-register on first login)
  let user = findUserByEmail.get(email);
  if (!user) {
    const displayName = email.split('@')[0];
    createUser.run(email, displayName);
    user = findUserByEmail.get(email);
  }

  analytics.track(user.id, 'magic_link_requested', { email });

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

  res.locals.layout = 'layouts/app-shell';
  res.render('login', {
    pageTitle: 'Check Your Email',
    step: 'sent',
    email,
    error: null,
    invite: null,
  });
});

// ---------------------------------------------------------------------------
// GET /auth/callback?token=xxx — validate token, set session
// ---------------------------------------------------------------------------
router.get('/auth/callback', (req, res) => {
  const { token } = req.query;

  if (!token) {
    res.locals.layout = 'layouts/app-shell';
    return res.render('login', {
      pageTitle: 'Invalid Link',
      step: 'error',
      email: null,
      error: 'This login link is invalid.',
      invite: null,
    });
  }

  const row = findValidToken.get(token);
  if (!row) {
    res.locals.layout = 'layouts/app-shell';
    return res.render('login', {
      pageTitle: 'Link Expired',
      step: 'error',
      email: null,
      error: 'This login link has expired or has already been used. Please request a new one.',
      invite: null,
    });
  }

  // Mark token as used
  markTokenUsed.run(row.id);

  // Set session
  req.session.userId = row.uid;
  analytics.track(row.uid, 'user_login', { method: 'magic_link' });

  // Attribute invite if present
  if (req.session.inviteCode) {
    db.prepare('UPDATE invites SET use_count = use_count + 1 WHERE code = ?').run(req.session.inviteCode);
    delete req.session.inviteCode;
  }

  req.session.save((err) => {
    if (err) console.error('Session save error:', err);
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/password-login — email + password sign-in or registration
// ---------------------------------------------------------------------------
router.post('/auth/password-login', authLimiter, ...emailChain, handleValidationErrors, (req, res) => {
  const email = req.body.email; // already trimmed + lowercased by chain
  const password = req.body.password || '';

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  let user = db.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?').get(email);

  if (!user) {
    // New user — create account with hashed password (mirrors magic-link auto-registration)
    const hash = bcrypt.hashSync(password, 12);
    const displayName = email.split('@')[0];
    db.prepare("INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, 'member')").run(email, displayName, hash);
    user = db.prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?').get(email);
  } else if (!user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  analytics.track(user.id, 'user_login', { method: 'password' });

  // Attribute invite if present
  if (req.session.inviteCode) {
    db.prepare('UPDATE invites SET use_count = use_count + 1 WHERE code = ?').run(req.session.inviteCode);
    delete req.session.inviteCode;
  }

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
