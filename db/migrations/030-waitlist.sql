-- GatherBound waitlist signups, collected from the public /landing page.
--
-- Replaces the embedded Tally form with a native form that posts to
-- POST /waitlist. name + email are required; club_name and city_state are
-- optional context. email is UNIQUE so a repeat submission is a no-op
-- (treated as "already on the list", not an error).
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  club_name   TEXT,
  city_state  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist_signups(created_at DESC);
