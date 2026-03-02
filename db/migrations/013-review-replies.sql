-- 013-review-replies.sql
-- Flat reply threads under reviews. One level deep, no nesting.

CREATE TABLE IF NOT EXISTS review_replies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id      INTEGER NOT NULL,
  user_id        INTEGER NOT NULL,
  body_markdown  TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_replies_review ON review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_user   ON review_replies(user_id);
