const router = require('express').Router();

router.get('/', (req, res) => {
  res.render('home', { pageTitle: 'Home' });
});

router.get('/history', (req, res) => {
  res.render('history', { pageTitle: 'History' });
});

router.get('/books/:bookId{/:slug}', (req, res) => {
  res.render('book-detail', { pageTitle: 'Book Detail' });
});

module.exports = router;
