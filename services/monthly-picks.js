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

module.exports = {
  getCurrent,
  getByMonthYear,
  getById,
  getAll,
  create,
  advanceStatus,
  findByBookAndMonth,
};
