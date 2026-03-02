'use strict';

const router = require('express').Router();
const db = require('../db');
const { requireMember } = require('../middleware/auth');
const reviews = require('../services/reviews');
const { bookPath } = require('../utils/slug');
const { stripMarkdown } = require('../utils/markdown');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getCoverUrl(book) {
  return book.cover_url || null;
}

const lookupBook = db.prepare(`
  SELECT b.*, mp.month_year
  FROM books b
  LEFT JOIN monthly_picks mp ON mp.book_id = b.id
  WHERE b.author_slug = ? AND b.title_slug = ?
  ORDER BY mp.month_year DESC
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

  // Compute grade stats for the summary bar
  let avgGrade = null;
  const gradeDistribution = [];

  if (userReviews.length > 0) {
    const avgWeight = userReviews.reduce((sum, r) => sum + r.weight, 0) / userReviews.length;

    // Convert average weight to closest letter grade
    const allGrades = reviews.getAllGrades();
    let closest = allGrades[0];
    let minDiff = Math.abs(avgWeight - closest.weight);
    for (const g of allGrades) {
      const diff = Math.abs(avgWeight - g.weight);
      if (diff < minDiff) {
        minDiff = diff;
        closest = g;
      }
    }
    avgGrade = closest.grade;

    // Build distribution: count per grade
    const counts = {};
    for (const r of userReviews) {
      counts[r.grade] = (counts[r.grade] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    for (const g of allGrades) {
      const count = counts[g.grade] || 0;
      if (count > 0) {
        gradeDistribution.push({
          grade: g.grade,
          count,
          pct: Math.round((count / maxCount) * 100),
        });
      }
    }
  }

  res.render('my-reviews', {
    pageTitle: 'My Reviews',
    reviews: userReviews,
    avgGrade,
    gradeDistribution,
    getCoverUrl,
    bookPath,
    stripMarkdown,
  });
});

module.exports = router;
