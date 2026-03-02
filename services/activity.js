'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Activity feed — union of reviews, replies, reactions & nominations */
/* ------------------------------------------------------------------ */

/**
 * Fetch recent activity across the club.
 * Returns compact one-liner data for the home page feed.
 *
 * Types:
 *   review     — "Jane reviewed Children of Time — A+"
 *   reply      — "Bob replied to Jane's review of Children of Time"
 *   reaction   — "Carol reacted 🔥 to Jane's review of Children of Time"
 *   nomination — "Dave nominated Dune for March 2026"
 *
 * @param {number} [limit=15]  Maximum items to return.
 * @returns {Array<Object>}
 */
const getRecent = db.prepare(`
  SELECT * FROM (

    SELECT
      'review'          AS type,
      r.id              AS item_id,
      r.created_at,
      u.display_name    AS actor_name,
      u.avatar_style    AS actor_avatar,
      u.user_slug       AS actor_slug,
      u.email           AS actor_email,
      b.title           AS book_title,
      b.author          AS book_author,
      b.title_slug,
      b.author_slug,
      r.grade,
      NULL              AS emoji,
      NULL              AS target_name,
      NULL              AS target_slug,
      NULL              AS meeting_month_year
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    JOIN books b ON b.id = r.book_id

    UNION ALL

    SELECT
      'reply'           AS type,
      rr.id             AS item_id,
      rr.created_at,
      u.display_name    AS actor_name,
      u.avatar_style    AS actor_avatar,
      u.user_slug       AS actor_slug,
      u.email           AS actor_email,
      b.title           AS book_title,
      b.author          AS book_author,
      b.title_slug,
      b.author_slug,
      NULL              AS grade,
      NULL              AS emoji,
      tu.display_name   AS target_name,
      tu.user_slug      AS target_slug,
      NULL              AS meeting_month_year
    FROM review_replies rr
    JOIN users u  ON u.id = rr.user_id
    JOIN reviews rv ON rv.id = rr.review_id
    JOIN users tu ON tu.id = rv.user_id
    JOIN books b  ON b.id = rv.book_id

    UNION ALL

    SELECT
      'reaction'        AS type,
      re.id             AS item_id,
      re.created_at,
      u.display_name    AS actor_name,
      u.avatar_style    AS actor_avatar,
      u.user_slug       AS actor_slug,
      u.email           AS actor_email,
      b.title           AS book_title,
      b.author          AS book_author,
      b.title_slug,
      b.author_slug,
      NULL              AS grade,
      re.emoji,
      tu.display_name   AS target_name,
      tu.user_slug      AS target_slug,
      NULL              AS meeting_month_year
    FROM review_reactions re
    JOIN users u  ON u.id = re.user_id
    JOIN reviews rv ON rv.id = re.review_id
    JOIN users tu ON tu.id = rv.user_id
    JOIN books b  ON b.id = rv.book_id

    UNION ALL

    SELECT
      'nomination'      AS type,
      n.id              AS item_id,
      n.created_at,
      u.display_name    AS actor_name,
      u.avatar_style    AS actor_avatar,
      u.user_slug       AS actor_slug,
      u.email           AS actor_email,
      b.title           AS book_title,
      b.author          AS book_author,
      b.title_slug,
      b.author_slug,
      NULL              AS grade,
      NULL              AS emoji,
      NULL              AS target_name,
      NULL              AS target_slug,
      m.month_year      AS meeting_month_year
    FROM nominations n
    JOIN users u    ON u.id = n.user_id
    JOIN books b    ON b.id = n.book_id
    JOIN meetings m ON m.id = n.meeting_id
    WHERE n.user_id IS NOT NULL

  )
  ORDER BY created_at DESC
  LIMIT ?
`);

/**
 * Get the most recent activity items.
 * @param {number} [limit=15]
 * @returns {Array<Object>}
 */
function getRecentActivity(limit) {
  return getRecent.all(limit || 15);
}

module.exports = { getRecentActivity };
