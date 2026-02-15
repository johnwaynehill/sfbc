const router = require('express').Router();

// All admin routes use admin-shell layout
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
