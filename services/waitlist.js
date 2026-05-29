'use strict';

const db = require('../db');

// email is normalized (trimmed + lowercased) by the validation chain before it
// reaches here. ON CONFLICT keeps a repeat signup idempotent.
const insertStmt = db.prepare(`
  INSERT INTO waitlist_signups (name, email, club_name, city_state)
  VALUES (@name, @email, @clubName, @cityState)
  ON CONFLICT(email) DO NOTHING
`);

const countStmt = db.prepare('SELECT COUNT(*) AS cnt FROM waitlist_signups');

const recentStmt = db.prepare(`
  SELECT id, name, email, club_name, city_state, created_at
  FROM waitlist_signups
  ORDER BY created_at DESC, id DESC
  LIMIT ?
`);

/**
 * Record a waitlist signup. Returns { created } — false when the email was
 * already on the list (so callers can skip the notification email).
 */
function addSignup({ name, email, clubName = null, cityState = null }) {
  const info = insertStmt.run({
    name,
    email,
    clubName: clubName || null,
    cityState: cityState || null,
  });
  return { created: info.changes > 0 };
}

function countSignups() {
  return countStmt.get().cnt;
}

function getRecent(limit = 100) {
  return recentStmt.all(limit);
}

module.exports = { addSignup, countSignups, getRecent };
