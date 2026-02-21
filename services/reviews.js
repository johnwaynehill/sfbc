'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const stmts = {
  getByBookAndUser: db.prepare(`
    SELECT r.id, r.book_id, r.user_id, r.grade, r.body_markdown,
           r.created_at, r.updated_at, gw.weight
    FROM reviews r
    JOIN grade_weights gw ON gw.grade = r.grade
    WHERE r.book_id = ? AND r.user_id = ?
  `),

  getByUser: db.prepare(`
    SELECT r.id, r.book_id, r.grade, r.body_markdown,
           r.created_at, r.updated_at,
           b.title, b.author, b.author_slug, b.title_slug, b.cover_url,
           gw.weight
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    JOIN grade_weights gw ON gw.grade = r.grade
    ORDER BY r.updated_at DESC
  `),

  create: db.prepare(`
    INSERT INTO reviews (book_id, user_id, grade, body_markdown, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `),

  update: db.prepare(`
    UPDATE reviews SET grade = ?, body_markdown = ?, updated_at = datetime('now')
    WHERE book_id = ? AND user_id = ?
  `),

  deleteByBookAndUser: db.prepare(`
    DELETE FROM reviews WHERE book_id = ? AND user_id = ?
  `),

  getAllGrades: db.prepare(`
    SELECT grade, weight FROM grade_weights ORDER BY weight DESC
  `),
};

/* ------------------------------------------------------------------ */
/*  Exported functions                                                  */
/* ------------------------------------------------------------------ */

/** Get a single review by book + user (or undefined). */
function getByBookAndUser(bookId, userId) {
  return stmts.getByBookAndUser.get(bookId, userId);
}

/** Get all reviews by a user, with book info and grade weight. */
function getByUser(userId) {
  // Can't use a prepared statement bound to user_id in the WHERE
  // because the generic statement selects all — re-prepare with WHERE.
  return db.prepare(`
    SELECT r.id, r.book_id, r.grade, r.body_markdown,
           r.created_at, r.updated_at,
           b.title, b.author, b.author_slug, b.title_slug, b.cover_url,
           gw.weight
    FROM reviews r
    JOIN books b ON b.id = r.book_id
    JOIN grade_weights gw ON gw.grade = r.grade
    WHERE r.user_id = ?
    ORDER BY r.updated_at DESC
  `).all(userId);
}

/** Create a new review. Returns the insert info. */
function create(bookId, userId, grade, body) {
  return stmts.create.run(bookId, userId, grade, body || null);
}

/** Update an existing review. Returns the update info. */
function update(bookId, userId, grade, body) {
  return stmts.update.run(grade, body || null, bookId, userId);
}

/** Delete a user's review for a specific book. Returns the change info. */
function deleteByBookAndUser(bookId, userId) {
  return stmts.deleteByBookAndUser.run(bookId, userId);
}

/** Get all 16 grades from S to F-, ordered by weight DESC. */
function getAllGrades() {
  return stmts.getAllGrades.all();
}

module.exports = { getByBookAndUser, getByUser, create, update, deleteByBookAndUser, getAllGrades };
