'use strict';

const router = require('express').Router();
const db = require('../db');
const { requireMember } = require('../middleware/auth');
const reviews = require('../services/reviews');
const { bookPath } = require('../utils/slug');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getCoverUrl(book) {
  return book.cover_url || null;
}

const lookupBook = db.prepare(`
  SELECT b.*, m.month_year
  FROM books b
  LEFT JOIN meetings m ON m.winning_book_id = b.id
  WHERE b.author_slug = ? AND b.title_slug = ?
  ORDER BY m.month_year DESC
  LIMIT 1
`);

/* ------------------------------------------------------------------ */
/*  GET /books/:authorSlug/:titleSlug/review — review form             */
/* ------------------------------------------------------------------ */
router.get('/books/:authorSlug/:titleSlug/review', requireMember, (req, res) => {
  const book = lookupBook.get(req.params.authorSlug, req.params.titleSlug);

  if (!book) {
    return res.status(404).render('error', {
      pageTitle: 'Not Found',
      errorCode: 404,
      errorMessage: 'Book not found.',
    });
  }

  const existing = reviews.getByBookAndUser(book.id, req.user.id);
  const grades = reviews.getAllGrades();

  res.render('review', {
    pageTitle: existing ? 'Edit Review' : 'Write Review',
    book,
    review: existing || null,
    grades,
    getCoverUrl,
    bookPath,
  });
});

/* ------------------------------------------------------------------ */
/*  GET /my-reviews — all reviews by current user                      */
/* ------------------------------------------------------------------ */
router.get('/my-reviews', requireMember, (req, res) => {
  const userReviews = reviews.getByUser(req.user.id);

  res.render('my-reviews', {
    pageTitle: 'My Reviews',
    reviews: userReviews,
    getCoverUrl,
    bookPath,
  });
});

module.exports = router;
