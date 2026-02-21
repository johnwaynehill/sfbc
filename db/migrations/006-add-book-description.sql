-- Add description and subjects (genres) to books table
ALTER TABLE books ADD COLUMN description TEXT;
ALTER TABLE books ADD COLUMN subjects TEXT;  -- JSON array of genre/subject strings
