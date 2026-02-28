-- Emoji reactions on reviews
CREATE TABLE IF NOT EXISTS review_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(review_id, user_id, emoji),
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON review_reactions(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON review_reactions(user_id);
