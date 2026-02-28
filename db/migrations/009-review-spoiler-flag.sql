-- Add spoiler flag to reviews
ALTER TABLE reviews ADD COLUMN has_spoilers INTEGER NOT NULL DEFAULT 0;
