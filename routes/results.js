const router = require('express').Router();

router.get('/results/:meetingId', (req, res) => {
  res.render('results', { pageTitle: 'Results' });
});

module.exports = router;
