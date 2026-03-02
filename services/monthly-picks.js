'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const getCurrentStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  WHERE mp.status IN ('reading', 'nominations', 'voting')
  ORDER BY mp.month_year DESC LIMIT 1
`);

const getByMonthYearStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  WHERE mp.month_year = ?
`);

const getByIdStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  WHERE mp.id = ?
`);

const getAllStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  ORDER BY mp.month_year DESC
`);

const createStmt = db.prepare(`
  INSERT INTO monthly_picks (book_id, month_year, status, nominated_by, picked_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

const updateStatusStmt = db.prepare(`
  UPDATE monthly_picks SET status = ?, updated_at = datetime('now') WHERE id = ?
`);

const getByBookAndMonthStmt = db.prepare(`
  SELECT id FROM monthly_picks WHERE book_id = ? AND month_year = ?
`);

/* ------------------------------------------------------------------ */
/*  Read-side queries (Phase 3: books as primary entity)               */
/* ------------------------------------------------------------------ */

/**
 * Home hero: the current active pick with full book data.
 * Prefers non-results (active lifecycle), falls back to most recent completed.
 */
const getHeroStmt = db.prepare(`
  SELECT mp.*, b.id AS book_id, b.title, b.author, b.cover_url, b.open_library_id,
         b.publication_year, b.page_count, b.author_slug, b.title_slug,
         b.description, b.subjects
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status != 'results'
  ORDER BY mp.month_year ASC
  LIMIT 1
`);

const getHeroFallbackStmt = db.prepare(`
  SELECT mp.*, b.id AS book_id, b.title, b.author, b.cover_url, b.open_library_id,
         b.publication_year, b.page_count, b.author_slug, b.title_slug,
         b.description, b.subjects
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results'
  ORDER BY mp.month_year DESC
  LIMIT 1
`);

/**
 * Recent completed picks for home page strip.
 * Optionally excludes a specific pick (the hero).
 */
const getRecentPicksStmt = db.prepare(`
  SELECT mp.month_year, mp.status, b.id AS book_id, b.title, b.author,
         b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
         (SELECT AVG(gw.weight) FROM reviews r2
          JOIN grade_weights gw ON gw.grade = r2.grade
          WHERE r2.book_id = b.id) AS avg_weight,
         (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results'
  ORDER BY mp.month_year DESC
`);

const getRecentPicksExcludingStmt = db.prepare(`
  SELECT mp.month_year, mp.status, b.id AS book_id, b.title, b.author,
         b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
         (SELECT AVG(gw.weight) FROM reviews r2
          JOIN grade_weights gw ON gw.grade = r2.grade
          WHERE r2.book_id = b.id) AS avg_weight,
         (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results' AND mp.id != ?
  ORDER BY mp.month_year DESC
`);

/** Total completed picks count. */
const countCompletedStmt = db.prepare(
  "SELECT COUNT(*) AS cnt FROM monthly_picks WHERE status = 'results'"
);

/** History page: all completed picks with grade + review info. */
const getHistoryStmt = db.prepare(`
  SELECT mp.month_year, mp.status, b.id AS book_id, b.title, b.author,
         b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
         b.subjects,
         (SELECT AVG(gw.weight) FROM reviews r2
          JOIN grade_weights gw ON gw.grade = r2.grade
          WHERE r2.book_id = b.id) AS avg_weight,
         (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results'
  ORDER BY mp.month_year DESC
`);

/** Book detail lookup: find pick info for a specific book. */
const getPickForBookStmt = db.prepare(`
  SELECT mp.month_year, mp.status AS pick_status
  FROM monthly_picks mp
  WHERE mp.book_id = ?
  ORDER BY mp.month_year DESC
  LIMIT 1
`);

/** Get the first event for a pick (for meeting-details-bar display). */
const getFirstEventStmt = db.prepare(`
  SELECT meeting_time, location_text, meetup_event_url
  FROM events
  WHERE monthly_pick_id = ?
  ORDER BY meeting_time ASC
  LIMIT 1
`);

/* ------------------------------------------------------------------ */
/*  Exported functions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Get the currently active monthly pick (reading, nominations, or voting).
 */
function getCurrent() {
  return getCurrentStmt.get() || null;
}

/**
 * Get a monthly pick by month_year string (e.g., "2026-03").
 */
function getByMonthYear(monthYear) {
  return getByMonthYearStmt.get(monthYear) || null;
}

/**
 * Get a monthly pick by ID.
 */
function getById(id) {
  return getByIdStmt.get(id) || null;
}

/**
 * Get all monthly picks, most recent first.
 */
function getAll() {
  return getAllStmt.all();
}

/**
 * Create a new monthly pick.
 * @param {number} bookId - The book selected for this month
 * @param {string} monthYear - e.g., "2026-03"
 * @param {string} [status='upcoming'] - Initial status
 * @param {number|null} [nominatedBy=null] - User ID of nominator
 * @returns {object} The created monthly pick row
 */
function create(bookId, monthYear, status = 'upcoming', nominatedBy = null) {
  const info = createStmt.run(bookId, monthYear, status, nominatedBy);
  return getByIdStmt.get(info.lastInsertRowid);
}

/**
 * Advance a monthly pick's status. No transition validation here —
 * that's handled by the meetings service which orchestrates both tables.
 * @param {number} id - monthly_picks.id
 * @param {string} newStatus - The new status
 */
function advanceStatus(id, newStatus) {
  updateStatusStmt.run(newStatus, id);
  return getByIdStmt.get(id);
}

/**
 * Find an existing monthly pick by book + month.
 * Useful for checking if a pick already exists before creating one.
 */
function findByBookAndMonth(bookId, monthYear) {
  return getByBookAndMonthStmt.get(bookId, monthYear) || null;
}

/* ------------------------------------------------------------------ */
/*  Phase 3: Read-side functions (books as primary entity)             */
/* ------------------------------------------------------------------ */

/**
 * Get the hero pick for the home page.
 * Prefers active lifecycle (reading/nominations/voting), falls back to most recent completed.
 */
function getHero() {
  return getHeroStmt.get() || getHeroFallbackStmt.get() || null;
}

/**
 * Get recent completed picks for the home page strip.
 * @param {number} limit - Max picks to return
 * @param {number|null} [excludePickId] - Pick to exclude (e.g., the hero)
 */
function getRecentPicks(limit, excludePickId = null) {
  if (excludePickId) {
    return getRecentPicksExcludingStmt.all(excludePickId).slice(0, limit);
  }
  return getRecentPicksStmt.all().slice(0, limit);
}

/**
 * Count total completed picks (books the club has read).
 */
function countCompleted() {
  return countCompletedStmt.get().cnt;
}

/**
 * Get all completed picks for the history page.
 */
function getHistory() {
  return getHistoryStmt.all();
}

/**
 * Get pick info for a specific book (for book detail page).
 * Returns { month_year, pick_status } or null.
 */
function getPickForBook(bookId) {
  return getPickForBookStmt.get(bookId) || null;
}

/**
 * Get the first scheduled event for a pick.
 * Returns { meeting_time, location_text, meetup_event_url } or null.
 */
function getFirstEvent(pickId) {
  return getFirstEventStmt.get(pickId) || null;
}

module.exports = {
  getCurrent,
  getByMonthYear,
  getById,
  getAll,
  create,
  advanceStatus,
  findByBookAndMonth,
  getHero,
  getRecentPicks,
  countCompleted,
  getHistory,
  getPickForBook,
  getFirstEvent,
};
