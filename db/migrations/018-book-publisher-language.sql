-- Add publisher and language columns to books
ALTER TABLE books ADD COLUMN publisher TEXT;
ALTER TABLE books ADD COLUMN language TEXT;
