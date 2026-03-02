-- Phase 3: Books as primary entity.
-- monthly_picks gains lifecycle columns (timestamps, vote results).
-- New events table decouples scheduled sessions from the lifecycle.

-- Lifecycle timestamps on monthly_picks
ALTER TABLE monthly_picks ADD COLUMN nominations_open_at TEXT;
ALTER TABLE monthly_picks ADD COLUMN nominations_close_at TEXT;
ALTER TABLE monthly_picks ADD COLUMN voting_open_at TEXT;
ALTER TABLE monthly_picks ADD COLUMN voting_close_at TEXT;
ALTER TABLE monthly_picks ADD COLUMN vote_results_json TEXT;

-- Events: scheduled discussion sessions, 1-to-many per pick
CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  monthly_pick_id  INTEGER NOT NULL REFERENCES monthly_picks(id) ON DELETE CASCADE,
  meeting_time     TEXT,
  location_text    TEXT,
  meetup_event_url TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_pick ON events(monthly_pick_id);
