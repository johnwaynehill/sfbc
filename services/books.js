'use strict';

const db = require('../db');
const config = require('../config');
const { slugify } = require('../utils/slug');

const API_KEY = config.googleBooksApiKey;

/* ------------------------------------------------------------------ */
/*  Google Books search (for live cover preview)                       */
/* ------------------------------------------------------------------ */

/**
 * Search Google Books API and return the best match with a thumbnail URL.
 * Returns null if no results or API key is missing.
 */
async function searchGoogleBooks(title, author) {
  if (!API_KEY) return null;

  const query = `intitle:${title}+inauthor:${author}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const vol = data.items[0];
    const info = vol.volumeInfo || {};

    // Extract ISBN (prefer ISBN_13)
    let isbn = null;
    if (info.industryIdentifiers) {
      const isbn13 = info.industryIdentifiers.find(i => i.type === 'ISBN_13');
      const isbn10 = info.industryIdentifiers.find(i => i.type === 'ISBN_10');
      isbn = (isbn13 || isbn10)?.identifier || null;
    }

    // Extract publication year
    let publicationYear = null;
    if (info.publishedDate) {
      const yearMatch = info.publishedDate.match(/^(\d{4})/);
      if (yearMatch) publicationYear = parseInt(yearMatch[1], 10);
    }

    // zoom=1 gives a reasonable thumbnail for previews (~200px)
    const coverUrl = `https://books.google.com/books/content?id=${vol.id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;

    return {
      googleBooksId: vol.id,
      title: info.title || title,
      author: (info.authors && info.authors[0]) || author,
      coverUrl,
      isbn,
      publicationYear,
      pageCount: info.pageCount || null,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Find or create a book in the database                              */
/* ------------------------------------------------------------------ */

const findBookStmt = db.prepare(
  'SELECT * FROM books WHERE title = ? AND author = ?'
);

const insertBookStmt = db.prepare(`
  INSERT INTO books (title, author, author_slug, title_slug, google_books_id, isbn, publication_year, page_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Look up a book by title + author. If it doesn't exist, create it with
 * slugs and any metadata we got from the API search.
 *
 * @param {string} title
 * @param {string} author
 * @param {object} [metadata] - Optional fields: googleBooksId, isbn, publicationYear, pageCount
 * @returns {object} The book row
 */
function findOrCreateBook(title, author, metadata = {}) {
  const trimTitle = title.trim();
  const trimAuthor = author.trim();

  let book = findBookStmt.get(trimTitle, trimAuthor);
  if (book) return book;

  const authorSlug = slugify(trimAuthor);
  const titleSlug = slugify(trimTitle);

  insertBookStmt.run(
    trimTitle,
    trimAuthor,
    authorSlug,
    titleSlug,
    metadata.googleBooksId || null,
    metadata.isbn || null,
    metadata.publicationYear || null,
    metadata.pageCount || null
  );

  return findBookStmt.get(trimTitle, trimAuthor);
}

module.exports = { searchGoogleBooks, findOrCreateBook };
