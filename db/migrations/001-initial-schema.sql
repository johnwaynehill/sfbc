-- ============================================================
-- 001-initial-schema.sql
-- All domain tables for the SF Book Club app
-- ============================================================

-- Users (admins authenticate with password, members via magic link)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  display_name  TEXT,
  password_hash TEXT,
  role          TEXT    NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'admin')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Magic link tokens (for member authentication)
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT    NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  used_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_user_id ON magic_link_tokens(user_id);

-- Books (canonical entity, reused across meetings)
CREATE TABLE IF NOT EXISTS books (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  author           TEXT    NOT NULL,
  cover_url        TEXT,
  google_books_id  TEXT,
  open_library_id  TEXT,
  publication_year INTEGER,
  page_count       INTEGER,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(title, author)
);

-- Meetings (monthly club context)
CREATE TABLE IF NOT EXISTS meetings (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  month_year           TEXT    NOT NULL,
  meetup_event_url     TEXT,
  meeting_time         TEXT,
  location_text        TEXT,
  status               TEXT    NOT NULL DEFAULT 'reading'
                       CHECK (status IN ('reading', 'nominations', 'voting', 'results')),
  winning_book_id      INTEGER REFERENCES books(id) ON DELETE SET NULL,
  nominations_open_at  TEXT,
  nominations_close_at TEXT,
  voting_open_at       TEXT,
  voting_close_at      TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_month_year ON meetings(month_year);

-- Meeting nominees (which books are nominees for a given meeting)
CREATE TABLE IF NOT EXISTS meeting_nominees (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  source     TEXT    NOT NULL DEFAULT 'nomination'
             CHECK (source IN ('nomination', 'admin_add')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(meeting_id, book_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_nominees_meeting_id ON meeting_nominees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_nominees_book_id ON meeting_nominees(book_id);

-- Nominations (one per fingerprint per meeting)
CREATE TABLE IF NOT EXISTS nominations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id            INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  book_id               INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  submitted_fingerprint TEXT    NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(meeting_id, submitted_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_nominations_meeting_id ON nominations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_nominations_book_id ON nominations(book_id);

-- Votes (one per fingerprint per meeting, stores ranked list)
CREATE TABLE IF NOT EXISTS votes (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id            INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  ranking_json          TEXT    NOT NULL,
  submitted_fingerprint TEXT    NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(meeting_id, submitted_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_votes_meeting_id ON votes(meeting_id);

-- Reviews (one per user per book)
CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade         TEXT    NOT NULL,
  body_markdown TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(book_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_book_id ON reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- Grade weights (reference/seed data for calculations)
CREATE TABLE IF NOT EXISTS grade_weights (
  grade  TEXT PRIMARY KEY,
  weight REAL NOT NULL
);

INSERT OR IGNORE INTO grade_weights (grade, weight) VALUES
  ('S',  4.3),
  ('A+', 4.0),
  ('A',  3.7),
  ('A-', 3.3),
  ('B+', 3.0),
  ('B',  2.7),
  ('B-', 2.3),
  ('C+', 2.0),
  ('C',  1.7),
  ('C-', 1.3),
  ('D+', 1.0),
  ('D',  0.7),
  ('D-', 0.3),
  ('F+', 0.2),
  ('F',  0.1),
  ('F-', 0.0);
