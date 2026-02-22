-- ============================================================
-- 007-profile-enhancements.sql
-- Add social links and avatar customization to users table
-- password_hash column already exists from 001-initial-schema
-- ============================================================

ALTER TABLE users ADD COLUMN goodreads_url TEXT;
ALTER TABLE users ADD COLUMN storygraph_url TEXT;
ALTER TABLE users ADD COLUMN instagram_handle TEXT;
ALTER TABLE users ADD COLUMN threads_handle TEXT;
ALTER TABLE users ADD COLUMN avatar_style TEXT DEFAULT 'initials';
