const router = require('express').Router();

router.get('/login', (req, res) => {
  res.locals.layout = 'layouts/focus-shell';
  res.render('login', { pageTitle: 'Sign In' });
});

router.get('/auth/callback', (req, res) => {
  res.locals.layout = 'layouts/focus-shell';
  res.render('login', { pageTitle: 'Verifying...' });
});

module.exports = router;
