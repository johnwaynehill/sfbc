-- Invite links for club members
CREATE TABLE IF NOT EXISTS invites (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  invited_by   INTEGER NOT NULL REFERENCES users(id),
  max_uses     INTEGER DEFAULT 1,
  use_count    INTEGER DEFAULT 0,
  expires_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
