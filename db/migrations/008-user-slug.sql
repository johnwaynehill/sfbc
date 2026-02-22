-- ============================================================
-- 008-user-slug.sql
-- Add user_slug column for public member profile URLs.
-- Slugs are populated by the post-migration JS seed in migrate.js.
-- ============================================================

ALTER TABLE users ADD COLUMN user_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_slug ON users(user_slug);
