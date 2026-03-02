'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const stmts = {
  /** Batch-fetch replies for a list of review IDs (with user info). */
  getBatch: db.prepare(`
    SELECT rr.id, rr.review_id, rr.user_id, rr.body_markdown,
           rr.created_at, rr.updated_at,
           u.display_name, u.avatar_style, u.user_slug, u.email
    FROM review_replies rr
    JOIN users u ON u.id = rr.user_id
    WHERE rr.review_id IN (SELECT value FROM json_each(?))
    ORDER BY rr.created_at ASC
  `),

  /** Count replies per review (for badge counts). */
  getCountsBatch: db.prepare(`
    SELECT review_id, COUNT(*) AS count
    FROM review_replies
    WHERE review_id IN (SELECT value FROM json_each(?))
    GROUP BY review_id
  `),

  /** Single reply by ID (for auth checks). */
  getById: db.prepare(`
    SELECT id, review_id, user_id, body_markdown, created_at, updated_at
    FROM review_replies WHERE id = ?
  `),

  /** Insert. */
  insert: db.prepare(`
    INSERT INTO review_replies (review_id, user_id, body_markdown)
    VALUES (?, ?, ?)
  `),

  /** Update body. */
  update: db.prepare(`
    UPDATE review_replies
    SET body_markdown = ?, updated_at = datetime('now')
    WHERE id = ?
  `),

  /** Delete. */
  delete: db.prepare(`
    DELETE FROM review_replies WHERE id = ?
  `),
};

/* ------------------------------------------------------------------ */
/*  Exported functions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Get all replies for a list of review IDs, keyed by review_id.
 * Returns: Map<reviewId, Array<reply>>
 */
function getRepliesBatch(reviewIds) {
  if (!reviewIds.length) return new Map();

  const rows = stmts.getBatch.all(JSON.stringify(reviewIds));
  const result = new Map();

  for (const row of rows) {
    if (!result.has(row.review_id)) {
      result.set(row.review_id, []);
    }
    result.get(row.review_id).push(row);
  }

  return result;
}

/**
 * Get reply counts for a list of review IDs.
 * Returns: Map<reviewId, number>
 */
function getReplyCountsBatch(reviewIds) {
  if (!reviewIds.length) return new Map();

  const rows = stmts.getCountsBatch.all(JSON.stringify(reviewIds));
  const result = new Map();

  for (const row of rows) {
    result.set(row.review_id, row.count);
  }

  return result;
}

/** Get a single reply by ID (for ownership checks). */
function getById(replyId) {
  return stmts.getById.get(replyId) || null;
}

/** Create a reply. Returns the new reply's ID. */
function create(reviewId, userId, bodyMarkdown) {
  const info = stmts.insert.run(reviewId, userId, bodyMarkdown);
  return info.lastInsertRowid;
}

/** Update a reply's body. */
function update(replyId, bodyMarkdown) {
  stmts.update.run(bodyMarkdown, replyId);
}

/** Delete a reply. */
function remove(replyId) {
  stmts.delete.run(replyId);
}

module.exports = {
  getRepliesBatch,
  getReplyCountsBatch,
  getById,
  create,
  update,
  remove,
};
