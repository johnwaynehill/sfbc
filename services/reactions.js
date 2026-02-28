'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const stmts = {
  /** Aggregated counts per review × emoji. */
  getCountsBatch: db.prepare(`
    SELECT review_id, emoji, COUNT(*) AS count
    FROM review_reactions
    WHERE review_id IN (SELECT value FROM json_each(?))
    GROUP BY review_id, emoji
    ORDER BY count DESC, emoji ASC
  `),

  /** Which emojis a specific user has reacted with. */
  getUserReactionsBatch: db.prepare(`
    SELECT review_id, emoji
    FROM review_reactions
    WHERE review_id IN (SELECT value FROM json_each(?))
      AND user_id = ?
  `),

  /** Check existence. */
  getReaction: db.prepare(`
    SELECT id FROM review_reactions
    WHERE review_id = ? AND user_id = ? AND emoji = ?
  `),

  /** Insert. */
  insert: db.prepare(`
    INSERT INTO review_reactions (review_id, user_id, emoji) VALUES (?, ?, ?)
  `),

  /** Delete. */
  delete: db.prepare(`
    DELETE FROM review_reactions WHERE review_id = ? AND user_id = ? AND emoji = ?
  `),

  /** Count for a single emoji on a review. */
  countSingle: db.prepare(`
    SELECT COUNT(*) AS count FROM review_reactions WHERE review_id = ? AND emoji = ?
  `),
};

/* ------------------------------------------------------------------ */
/*  Exported functions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Get reaction counts for a list of review IDs.
 * Returns: Map<reviewId, Array<{emoji, count}>>
 */
function getReactionCountsBatch(reviewIds) {
  if (!reviewIds.length) return new Map();

  const rows = stmts.getCountsBatch.all(JSON.stringify(reviewIds));
  const result = new Map();

  for (const row of rows) {
    if (!result.has(row.review_id)) {
      result.set(row.review_id, []);
    }
    result.get(row.review_id).push({ emoji: row.emoji, count: row.count });
  }

  return result;
}

/**
 * Get which emojis a user has reacted with for a list of review IDs.
 * Returns: Map<reviewId, Set<emoji>>
 */
function getUserReactionsBatch(reviewIds, userId) {
  if (!reviewIds.length || !userId) return new Map();

  const rows = stmts.getUserReactionsBatch.all(JSON.stringify(reviewIds), userId);
  const result = new Map();

  for (const row of rows) {
    if (!result.has(row.review_id)) {
      result.set(row.review_id, new Set());
    }
    result.get(row.review_id).add(row.emoji);
  }

  return result;
}

/**
 * Toggle a reaction: if exists → remove, if not → add.
 * Returns: { added: boolean, count: number }
 */
function toggleReaction(reviewId, userId, emoji) {
  const existing = stmts.getReaction.get(reviewId, userId, emoji);

  if (existing) {
    stmts.delete.run(reviewId, userId, emoji);
  } else {
    stmts.insert.run(reviewId, userId, emoji);
  }

  const { count } = stmts.countSingle.get(reviewId, emoji);

  return { added: !existing, count };
}

module.exports = { getReactionCountsBatch, getUserReactionsBatch, toggleReaction };
