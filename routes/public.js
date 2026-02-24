'use strict';

const router = require('express').Router();
const db = require('../db');
const { slugify, bookPath } = require('../utils/slug');
const { formatMonthYear } = require('../utils/format');
const { requireMember } = require('../middleware/auth');
const { enrichBookMetadata } = require('../services/books');
const { renderMarkdown } = require('../utils/markdown');
const meetingsService = require('../services/meetings');

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

  const totalBooks = db.prepare("SELECT COUNT(*) AS count FROM meetings WHERE status = 'results' AND winning_book_id IS NOT NULL").get().count;

  // Active participation meeting (nominations or voting) — may or may not have a book
  const activeMeeting = db.prepare(`
    SELECT id, month_year, status
    FROM meetings
    WHERE status IN ('nominations', 'voting')
    ORDER BY month_year ASC
    LIMIT 1
  `).get() || null;

  // Upcoming meetings (status = 'upcoming', ordered by month_year ASC)
  const upcomingMeetings = meetingsService.getUpcoming().map(m => {
    // Enrich with full book data if a winner is set
    if (m.winning_book_id) {
      const book = db.prepare('SELECT title, author, cover_url, author_slug, title_slug FROM books WHERE id = ?').get(m.winning_book_id);
      if (book) Object.assign(m, book);
    }
    return m;
  });

  // Parse subjects JSON for hero display
  let heroSubjects = [];
  if (currentMeeting && currentMeeting.subjects) {
    try { heroSubjects = JSON.parse(currentMeeting.subjects); } catch { /* ignore */ }
  }

  res.render('home', {
    pageTitle: 'Home',
    currentMeeting,
    activeMeeting,
    recentBooks,
    upcomingMeetings,
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
// GET /about — About the club
// ---------------------------------------------------------------------------
router.get('/about', (req, res) => {
  const totalBooks = db.prepare("SELECT COUNT(*) AS count FROM meetings WHERE status = 'results' AND winning_book_id IS NOT NULL").get().count;
  const totalMembers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const totalReviews = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;

  res.render('about', {
    pageTitle: 'About',
    totalBooks,
    totalMembers,
    totalReviews,
  });
});

// ---------------------------------------------------------------------------
// GET /profile — User profile page
// ---------------------------------------------------------------------------
router.get('/profile', requireMember, (req, res) => {
  const profileUser = db.prepare(
    'SELECT id, email, display_name, avatar_style, goodreads_url, storygraph_url, instagram_handle, threads_handle, password_hash FROM users WHERE id = ?'
  ).get(req.user.id);

  res.render('profile', {
    pageTitle: 'Profile',
    profileUser: {
      ...profileUser,
      hasPassword: !!profileUser.password_hash,
      password_hash: undefined, // never expose hash to template
    },
    pageScript: '/js/profile.js',
  });
});

// ---------------------------------------------------------------------------
// GET /members/:slug — Public member profile
// ---------------------------------------------------------------------------
router.get('/members/:slug', requireMember, (req, res) => {
  const member = db.prepare(`
    SELECT id, display_name, email, avatar_style, user_slug,
           goodreads_url, storygraph_url, instagram_handle, threads_handle,
           created_at
    FROM users
    WHERE user_slug = ?
  `).get(req.params.slug);

  if (!member) {
    return res.status(404).render('error', {
      pageTitle: 'Member Not Found',
      errorCode: 404,
      errorMessage: 'This member profile does not exist.',
    });
  }

  // Reading stats
  const stats = db.prepare(`
    SELECT COUNT(r.id) AS review_count,
           AVG(gw.weight) AS avg_weight
    FROM reviews r
    JOIN grade_weights gw ON gw.grade = r.grade
    WHERE r.user_id = ?
  `).get(member.id);

  const avgGrade = stats.avg_weight != null ? weightToGrade(stats.avg_weight) : null;

  // Their reviews with book info
  const reviews = db.prepare(`
    SELECT r.id, r.grade, r.body_markdown, r.created_at, r.updated_at,
           b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
           gw.weight
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    JOIN grade_weights gw ON gw.grade = r.grade
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(member.id);

  res.render('member-profile', {
    pageTitle: member.display_name || 'Member Profile',
    member,
    stats: { ...stats, avgGrade },
    reviews,
    getCoverUrl,
    weightToGrade,
    formatMonthYear,
    bookPath,
    renderMarkdown,
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
    SELECT r.id, r.grade, r.body_markdown, r.created_at, r.updated_at,
           r.user_id, u.display_name, u.avatar_style, u.user_slug, u.email,
           gw.weight
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
    renderMarkdown,
  });
});

module.exports = router;
