-- Announcements for the home page
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'warning', 'success')),
  title TEXT NOT NULL,
  body TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
