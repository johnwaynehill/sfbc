-- ============================================================
-- 016-add-scheduled-status.sql
-- Add 'scheduled' status for meetings at the start of their lifecycle
-- (before nominations). Reserving 'upcoming' for post-voting picks.
--
-- Lifecycle: scheduled → nominations → voting → upcoming → reading → results
--
-- SQLite doesn't support ALTER CHECK, so we recreate both tables.
-- ============================================================

-- ── meetings table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings_new (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  month_year           TEXT    NOT NULL,
  meetup_event_url     TEXT,
  meeting_time         TEXT,
  location_text        TEXT,
  status               TEXT    NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled', 'upcoming', 'reading', 'nominations', 'voting', 'results')),
  winning_book_id      INTEGER REFERENCES books(id) ON DELETE SET NULL,
  nominations_open_at  TEXT,
  nominations_close_at TEXT,
  voting_open_at       TEXT,
  voting_close_at      TEXT,
  vote_results_json    TEXT,
  monthly_pick_id      INTEGER REFERENCES monthly_picks(id) ON DELETE SET NULL,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO meetings_new
  SELECT id, month_year, meetup_event_url, meeting_time, location_text,
         -- Convert 'upcoming' meetings without a winner to 'scheduled'
         CASE
           WHEN status = 'upcoming' AND winning_book_id IS NULL THEN 'scheduled'
           ELSE status
         END,
         winning_book_id, nominations_open_at, nominations_close_at,
         voting_open_at, voting_close_at, vote_results_json,
         monthly_pick_id, created_at, updated_at
  FROM meetings;

DROP TABLE meetings;
ALTER TABLE meetings_new RENAME TO meetings;

CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_month_year ON meetings(month_year);

-- ── monthly_picks table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS monthly_picks_new (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id              INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  month_year           TEXT    NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'upcoming'
                       CHECK(status IN ('scheduled', 'upcoming', 'reading', 'nominations', 'voting', 'results')),
  nominated_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  picked_at            TEXT,
  nominations_open_at  TEXT,
  nominations_close_at TEXT,
  voting_open_at       TEXT,
  voting_close_at      TEXT,
  vote_results_json    TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(book_id, month_year)
);

INSERT INTO monthly_picks_new
  SELECT id, book_id, month_year, status, nominated_by, picked_at,
         nominations_open_at, nominations_close_at,
         voting_open_at, voting_close_at, vote_results_json,
         created_at, updated_at
  FROM monthly_picks;

DROP TABLE monthly_picks;
ALTER TABLE monthly_picks_new RENAME TO monthly_picks;

CREATE INDEX IF NOT EXISTS idx_monthly_picks_month ON monthly_picks(month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_picks_status ON monthly_picks(status);
CREATE INDEX IF NOT EXISTS idx_monthly_picks_book ON monthly_picks(book_id);
