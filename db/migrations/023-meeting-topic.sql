-- Add optional topic/theme to meetings.
-- The topic is set by admins during the scheduled/nominations phase, before a
-- monthly_pick row exists (picks require a winning book, so they're created
-- only after voting closes). Storing it on the meeting ensures it's always
-- available for display on the nominate/nominations pages.
--
-- Backfill from any linked monthly_pick.topic so existing data isn't lost.
ALTER TABLE meetings ADD COLUMN topic TEXT;

UPDATE meetings
SET topic = (
  SELECT mp.topic FROM monthly_picks mp
  WHERE mp.id = meetings.monthly_pick_id AND mp.topic IS NOT NULL
)
WHERE topic IS NULL AND monthly_pick_id IS NOT NULL;
