-- Add slug columns for human-readable book URLs: /books/:authorSlug/:titleSlug
ALTER TABLE books ADD COLUMN author_slug TEXT;
ALTER TABLE books ADD COLUMN title_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_slugs ON books(author_slug, title_slug);
