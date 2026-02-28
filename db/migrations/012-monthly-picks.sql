-- monthly_picks: books become the primary entity; meetings become instances.
-- A monthly_pick is a book selected for a particular month.
CREATE TABLE IF NOT EXISTS monthly_picks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  month_year      TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'upcoming'
                  CHECK(status IN ('upcoming', 'reading', 'nominations', 'voting', 'results')),
  nominated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  picked_at       TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(book_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_picks_month ON monthly_picks(month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_picks_status ON monthly_picks(status);
CREATE INDEX IF NOT EXISTS idx_monthly_picks_book ON monthly_picks(book_id);

-- Link meetings to monthly_picks for dual-write
ALTER TABLE meetings ADD COLUMN monthly_pick_id INTEGER REFERENCES monthly_picks(id) ON DELETE SET NULL;
