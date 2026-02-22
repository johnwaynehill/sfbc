'use strict';

const db = require('../db');
const config = require('../config');

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/admin/login');
  }

  const user = db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ?')
    .get(req.session.userId);

  if (!user || user.role !== 'admin') {
    return res.redirect('/admin/login');
  }

  // Flag super-admin based on env-configured email
  user.isSuperAdmin = !!(
    config.superAdminEmail &&
    user.email &&
    user.email.toLowerCase() === config.superAdminEmail
  );

  req.user = user;
  next();
}

function requireMember(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  const user = db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ?')
    .get(req.session.userId);

  if (!user) {
    delete req.session.userId;
    return res.redirect('/login');
  }

  req.user = user;
  next();
}

module.exports = { requireAdmin, requireMember };
