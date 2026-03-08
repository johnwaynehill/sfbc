-- Add "did not finish" flag to reviews (default: 1 = finished)
ALTER TABLE reviews ADD COLUMN did_finish INTEGER NOT NULL DEFAULT 1;
