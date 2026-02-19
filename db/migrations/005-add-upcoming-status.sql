-- ============================================================
-- 005-add-upcoming-status.sql
-- Add 'upcoming' to the meeting status CHECK constraint.
-- SQLite doesn't support ALTER CHECK, so we recreate the table.
-- ============================================================

-- 1. Create new table with updated constraint
CREATE TABLE IF NOT EXISTS meetings_new (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  month_year           TEXT    NOT NULL,
  meetup_event_url     TEXT,
  meeting_time         TEXT,
  location_text        TEXT,
  status               TEXT    NOT NULL DEFAULT 'reading'
                       CHECK (status IN ('upcoming', 'reading', 'nominations', 'voting', 'results')),
  winning_book_id      INTEGER REFERENCES books(id) ON DELETE SET NULL,
  nominations_open_at  TEXT,
  nominations_close_at TEXT,
  voting_open_at       TEXT,
  voting_close_at      TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 2. Copy all existing data
INSERT INTO meetings_new
  SELECT * FROM meetings;

-- 3. Drop old table, rename new one
DROP TABLE meetings;
ALTER TABLE meetings_new RENAME TO meetings;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_month_year ON meetings(month_year);
