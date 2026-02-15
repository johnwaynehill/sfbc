const router = require('express').Router();

router.get('/vote/:meetingId', (req, res) => {
  res.locals.layout = 'layouts/focus-shell';
  res.render('vote', { pageTitle: 'Vote' });
});

module.exports = router;
