'use strict';

const router = require('express').Router();
const db = require('../db');
const { slugify, bookPath } = require('../utils/slug');
const { formatMonthYear } = require('../utils/format');
const { requireMember } = require('../middleware/auth');
const { enrichBookMetadata } = require('../services/books');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a cover image URL for a book row.
 * Covers are stored locally in public/img/covers/ via scripts/fetch-covers.js.
 */
function getCoverUrl(book) {
  return book.cover_url || null;
}

/**
 * Cache grade_weights once so we don't query every request.
 */
let _gradeWeights = null;
function getGradeWeights() {
  if (!_gradeWeights) {
    _gradeWeights = db.prepare('SELECT grade, weight FROM grade_weights ORDER BY weight DESC').all();
  }
  return _gradeWeights;
}

/**
 * Convert a numeric weight to its closest letter grade.
 */
function weightToGrade(weight) {
  if (weight == null) return null;
  const grades = getGradeWeights();
  let closest = grades[0];
  let minDiff = Math.abs(weight - closest.weight);
  for (const g of grades) {
    const diff = Math.abs(weight - g.weight);
    if (diff < minDiff) {
      minDiff = diff;
      closest = g;
    }
  }
  return closest.grade;
}

// ---------------------------------------------------------------------------
// GET / — Home page
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  // Current meeting: prefer the nearest active (non-results) meeting,
  // fall back to the most recent completed one
  const currentMeeting = (
    db.prepare(`
      SELECT m.*, b.id AS book_id, b.title, b.author, b.cover_url, b.open_library_id,
             b.publication_year, b.page_count, b.author_slug, b.title_slug,
             b.description, b.subjects
      FROM meetings m
      JOIN books b ON b.id = m.winning_book_id
      WHERE m.status != 'results'
      ORDER BY m.month_year ASC
      LIMIT 1
    `).get()
    ||
    db.prepare(`
      SELECT m.*, b.id AS book_id, b.title, b.author, b.cover_url, b.open_library_id,
             b.publication_year, b.page_count, b.author_slug, b.title_slug,
             b.description, b.subjects
      FROM meetings m
      JOIN books b ON b.id = m.winning_book_id
      WHERE m.status = 'results'
      ORDER BY m.month_year DESC
      LIMIT 1
    `).get()
  );

  // Last 6 finished books (skip the current one)
  const recentBooks = db.prepare(`
    SELECT m.month_year, m.status, b.id AS book_id, b.title, b.author,
           b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
           (SELECT AVG(gw.weight) FROM reviews r2
            JOIN grade_weights gw ON gw.grade = r2.grade
            WHERE r2.book_id = b.id) AS avg_weight,
           (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
    FROM meetings m
    JOIN books b ON b.id = m.winning_book_id
    WHERE m.status = 'results'
    ${currentMeeting ? 'AND m.id != ?' : ''}
    ORDER BY m.month_year DESC
    LIMIT 6
  `).all(...(currentMeeting ? [currentMeeting.id] : []));

  const totalBooks = db.prepare('SELECT COUNT(*) AS count FROM books').get().count;

  // Parse subjects JSON for hero display
  let heroSubjects = [];
  if (currentMeeting && currentMeeting.subjects) {
    try { heroSubjects = JSON.parse(currentMeeting.subjects); } catch { /* ignore */ }
  }

  res.render('home', {
    pageTitle: 'Home',
    currentMeeting,
    recentBooks,
    totalBooks,
    heroSubjects,
    getCoverUrl,
    weightToGrade,
    formatMonthYear,
    bookPath,
  });
});

// ---------------------------------------------------------------------------
// GET /history — All past books
// ---------------------------------------------------------------------------
router.get('/history', (req, res) => {
  const books = db.prepare(`
    SELECT m.month_year, m.status, b.id AS book_id, b.title, b.author,
           b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
           (SELECT AVG(gw.weight) FROM reviews r2
            JOIN grade_weights gw ON gw.grade = r2.grade
            WHERE r2.book_id = b.id) AS avg_weight,
           (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
    FROM meetings m
    JOIN books b ON b.id = m.winning_book_id
    WHERE m.status = 'results'
    ORDER BY m.month_year DESC
  `).all();

  res.render('history', {
    pageTitle: 'History',
    books,
    getCoverUrl,
    weightToGrade,
    formatMonthYear,
    bookPath,
  });
});

// ---------------------------------------------------------------------------
// GET /profile — User profile page
// ---------------------------------------------------------------------------
router.get('/profile', requireMember, (req, res) => {
  res.render('profile', {
    pageTitle: 'Profile',
  });
});

// ---------------------------------------------------------------------------
// GET /books/:authorSlug/:titleSlug — Book detail
// ---------------------------------------------------------------------------
router.get('/books/:authorSlug/:titleSlug', async (req, res) => {
  let book = db.prepare(`
    SELECT b.*, m.month_year, m.meeting_time, m.location_text,
           m.meetup_event_url, m.status AS meeting_status
    FROM books b
    LEFT JOIN meetings m ON m.winning_book_id = b.id
    WHERE b.author_slug = ? AND b.title_slug = ?
    ORDER BY m.month_year DESC
    LIMIT 1
  `).get(req.params.authorSlug, req.params.titleSlug);

  if (!book) {
    return res.status(404).render('error', {
      pageTitle: 'Not Found',
      errorCode: 404,
      errorMessage: 'Book not found.',
    });
  }

  // Lazy-enrich metadata if description is missing
  if (book.description == null) {
    try {
      const enriched = await enrichBookMetadata(book.id);
      if (enriched) {
        // Re-fetch with meeting join to keep all fields
        book = db.prepare(`
          SELECT b.*, m.month_year, m.meeting_time, m.location_text,
                 m.meetup_event_url, m.status AS meeting_status
          FROM books b
          LEFT JOIN meetings m ON m.winning_book_id = b.id
          WHERE b.id = ?
          ORDER BY m.month_year DESC
          LIMIT 1
        `).get(book.id) || book;
      }
    } catch (err) {
      // Enrichment failure is non-fatal
      console.error('Book enrichment error:', err.message);
    }
  }

  // Parse subjects JSON
  let subjects = [];
  if (book.subjects) {
    try {
      subjects = JSON.parse(book.subjects);
    } catch { /* ignore */ }
  }

  // Reviews with display names
  const reviews = db.prepare(`
    SELECT r.grade, r.body_markdown, r.created_at, r.user_id,
           u.display_name, gw.weight
    FROM reviews r
    JOIN grade_weights gw ON gw.grade = r.grade
    JOIN users u ON u.id = r.user_id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(book.id);

  // Check if current user already has a review for this book
  const userId = req.session && req.session.userId ? req.session.userId : null;
  const userReview = userId
    ? reviews.find(r => r.user_id === userId)
    : null;

  // Grade stats
  let avgWeight = null;
  let avgGrade = null;
  const gradeDistribution = [];

  if (reviews.length > 0) {
    avgWeight = reviews.reduce((sum, r) => sum + r.weight, 0) / reviews.length;
    avgGrade = weightToGrade(avgWeight);

    // Build distribution: count per grade
    const counts = {};
    for (const r of reviews) {
      counts[r.grade] = (counts[r.grade] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    const allGrades = getGradeWeights();
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

  res.render('book-detail', {
    pageTitle: `${book.title} by ${book.author}`,
    book,
    subjects,
    reviews,
    userReview,
    avgGrade,
    gradeDistribution,
    getCoverUrl,
    formatMonthYear,
    bookPath,
  });
});

module.exports = router;
