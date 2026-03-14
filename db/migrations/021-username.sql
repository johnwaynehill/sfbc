-- Add dedicated username column (decoupled from display_name)
ALTER TABLE users ADD COLUMN username TEXT;

-- Seed usernames from existing user_slug values
UPDATE users SET username = user_slug WHERE user_slug IS NOT NULL;

-- Create unique index (SQLite can't add UNIQUE column directly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
