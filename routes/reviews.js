const router = require('express').Router();

router.get('/books/:bookId/review', (req, res) => {
  res.render('review', { pageTitle: 'Write Review' });
});

router.get('/my-reviews', (req, res) => {
  res.render('my-reviews', { pageTitle: 'My Reviews' });
});

module.exports = router;
