const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Admin login page (no auth required)
// ---------------------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    const db = require('../db');
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
  next();
});

router.get('/', (req, res) => {
  res.render('admin/overview', { pageTitle: 'Admin Overview' });
});

router.get('/nominations', (req, res) => {
  res.render('admin/overview', { pageTitle: 'Nominations' });
});

router.get('/results', (req, res) => {
  res.render('admin/overview', { pageTitle: 'Results' });
});

router.get('/settings', (req, res) => {
  res.render('admin/overview', { pageTitle: 'Settings' });
});

module.exports = router;
