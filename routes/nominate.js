const router = require('express').Router();

router.get('/nominate/:meetingId', (req, res) => {
  res.locals.layout = 'layouts/focus-shell';
  res.render('nominate', { pageTitle: 'Nominate a Book' });
});

module.exports = router;
