'use strict';

const path = require('path');
const fsp = require('fs/promises');
const db = require('../db');
const config = require('../config');
const { slugify } = require('../utils/slug');

const COVERS_DIR = path.join(__dirname, '..', 'public', 'img', 'covers');

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

    // Strip HTML tags from description
    let description = null;
    if (info.description) {
      description = info.description.replace(/<[^>]+>/g, '').trim();
    }

    return {
      googleBooksId: vol.id,
      title: info.title || title,
      author: (info.authors && info.authors[0]) || author,
      coverUrl,
      isbn,
      publicationYear,
      pageCount: info.pageCount || null,
      description,
      categories: info.categories || [],
      publisher: info.publisher || null,
      language: info.language || null,
    };
  } catch {
    return null;
  }
}

/**
 * Search Google Books API with a general query and return up to `max` results.
 */
async function searchGoogleBooksMulti(query, max = 5, startIndex = 0) {
  if (!API_KEY || !query || query.length < 3) return [];

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${max}&startIndex=${startIndex}&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.items || data.items.length === 0) return [];

    return data.items.map(vol => {
      const info = vol.volumeInfo || {};
      let year = null;
      if (info.publishedDate) {
        const m = info.publishedDate.match(/^(\d{4})/);
        if (m) year = parseInt(m[1], 10);
      }
      const coverUrl = `https://books.google.com/books/content?id=${vol.id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;

      let isbn = null;
      if (info.industryIdentifiers) {
        const isbn13 = info.industryIdentifiers.find(i => i.type === 'ISBN_13');
        const isbn10 = info.industryIdentifiers.find(i => i.type === 'ISBN_10');
        isbn = (isbn13 || isbn10)?.identifier || null;
      }

      return {
        googleBooksId: vol.id,
        title: info.title || '',
        author: (info.authors && info.authors[0]) || '',
        coverUrl,
        year,
        isbn,
        pageCount: info.pageCount || null,
      };
    });
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Find or create a book in the database                              */
/* ------------------------------------------------------------------ */

const findBookStmt = db.prepare(
  'SELECT * FROM books WHERE title = ? AND author = ?'
);

const insertBookStmt = db.prepare(`
  INSERT INTO books (title, author, author_slug, title_slug, google_books_id, isbn, publication_year, page_count, cover_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const checkSlugCollisionStmt = db.prepare(
  'SELECT id FROM books WHERE author_slug = ? AND title_slug = ?'
);

/**
 * Generate a unique (author_slug, title_slug) pair by appending a numeric
 * suffix if the base slug pair already exists for a different book.
 */
function uniqueTitleSlug(authorSlug, baseTitleSlug) {
  if (!checkSlugCollisionStmt.get(authorSlug, baseTitleSlug)) {
    return baseTitleSlug;
  }
  for (let i = 2; i <= 99; i++) {
    const candidate = baseTitleSlug + '-' + i;
    if (!checkSlugCollisionStmt.get(authorSlug, candidate)) {
      return candidate;
    }
  }
  // Extremely unlikely fallback
  return baseTitleSlug + '-' + Date.now();
}

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
  const titleSlug = uniqueTitleSlug(authorSlug, slugify(trimTitle));

  insertBookStmt.run(
    trimTitle,
    trimAuthor,
    authorSlug,
    titleSlug,
    metadata.googleBooksId || null,
    metadata.isbn || null,
    metadata.publicationYear || null,
    metadata.pageCount || null,
    metadata.coverUrl || null
  );

  return findBookStmt.get(trimTitle, trimAuthor);
}

/* ------------------------------------------------------------------ */
/*  Enrich a book with description & subjects from external APIs       */
/* ------------------------------------------------------------------ */

// Lazy-prepared statements (description/subjects columns added by migration 006)
let _getBookByIdStmt = null;
let _updateMetadataStmt = null;

function getBookByIdStmt() {
  if (!_getBookByIdStmt) {
    _getBookByIdStmt = db.prepare('SELECT * FROM books WHERE id = ?');
  }
  return _getBookByIdStmt;
}

function updateMetadataStmt() {
  if (!_updateMetadataStmt) {
    _updateMetadataStmt = db.prepare(`
      UPDATE books SET
        description = COALESCE(?, description),
        subjects = COALESCE(?, subjects),
        google_books_id = COALESCE(?, google_books_id),
        publisher = COALESCE(?, publisher),
        language = COALESCE(?, language),
        page_count = COALESCE(?, page_count),
        publication_year = COALESCE(?, publication_year),
        isbn = COALESCE(?, isbn),
        updated_at = datetime('now')
      WHERE id = ?
    `);
  }
  return _updateMetadataStmt;
}

/**
 * Fetch description and subjects from Google Books (and optionally Open Library)
 * for a specific book. Stores results in the DB.
 * Returns the updated book row, or null if enrichment failed.
 */
async function enrichBookMetadata(bookId) {
  const book = getBookByIdStmt().get(bookId);
  if (!book) return null;

  let description = null;
  let subjects = [];
  let googleBooksId = book.google_books_id;
  let publisher = null;
  let language = null;
  let pageCount = null;
  let publicationYear = null;
  let isbn = null;

  // Try Google Books first
  if (API_KEY) {
    try {
      // If we have a google_books_id, fetch directly; otherwise search
      let info = null;
      if (googleBooksId) {
        const url = `https://www.googleapis.com/books/v1/volumes/${googleBooksId}?key=${API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          info = data.volumeInfo || null;
        }
      }

      if (!info) {
        const result = await searchGoogleBooks(book.title, book.author);
        if (result) {
          description = result.description;
          subjects = result.categories || [];
          googleBooksId = result.googleBooksId;
          publisher = result.publisher;
          language = result.language;
          pageCount = result.pageCount;
          publicationYear = result.publicationYear;
          isbn = result.isbn;
        }
      } else {
        if (info.description) {
          description = info.description.replace(/<[^>]+>/g, '').trim();
        }
        subjects = info.categories || [];
        publisher = info.publisher || null;
        language = info.language || null;
        pageCount = info.pageCount || null;
        if (info.publishedDate) {
          const yearMatch = info.publishedDate.match(/^(\d{4})/);
          if (yearMatch) publicationYear = parseInt(yearMatch[1], 10);
        }
        if (info.industryIdentifiers) {
          const isbn13 = info.industryIdentifiers.find(i => i.type === 'ISBN_13');
          const isbn10 = info.industryIdentifiers.find(i => i.type === 'ISBN_10');
          isbn = (isbn13 || isbn10)?.identifier || null;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // Try Open Library as fallback/supplement for subjects
  try {
    const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&limit=1&fields=key,subject`;
    const olRes = await fetch(olUrl);
    if (olRes.ok) {
      const olData = await olRes.json();
      if (olData.docs && olData.docs.length > 0) {
        const doc = olData.docs[0];
        if (doc.subject && Array.isArray(doc.subject)) {
          // Merge unique subjects (take first 8 most relevant)
          const olSubjects = doc.subject
            .filter(s => s.length < 40) // skip overly long subjects
            .slice(0, 8);
          const combined = new Set([...subjects, ...olSubjects]);
          subjects = [...combined].slice(0, 10);
        }

        // If no description from Google, try Open Library Works API
        if (!description && doc.key) {
          try {
            const worksRes = await fetch(`https://openlibrary.org${doc.key}.json`);
            if (worksRes.ok) {
              const worksData = await worksRes.json();
              if (worksData.description) {
                description = typeof worksData.description === 'string'
                  ? worksData.description
                  : worksData.description.value || null;
              }
            }
          } catch {
            // Non-fatal
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // Store whatever we found
  if (description || subjects.length > 0 || publisher || language || pageCount || publicationYear || isbn) {
    updateMetadataStmt().run(
      description || null,
      subjects.length > 0 ? JSON.stringify(subjects) : null,
      googleBooksId || null,
      publisher || null,
      language || null,
      pageCount || null,
      publicationYear || null,
      isbn || null,
      bookId
    );
    return getBookByIdStmt().get(bookId);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Download a cover image to local disk                               */
/* ------------------------------------------------------------------ */

/**
 * Download an image from a URL and save it to the covers directory.
 * Rejects images smaller than 15KB (likely Google Books placeholders).
 *
 * @param {string} imageUrl - URL of the image to download
 * @param {string} filename - Filename to save as (e.g. "author_title.jpg")
 * @returns {Promise<string>} The local path (e.g. "/img/covers/author_title.jpg")
 */
async function downloadCover(imageUrl, filename) {
  await fsp.mkdir(COVERS_DIR, { recursive: true });

  const res = await fetch(imageUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.length < 15000) {
    throw new Error(`Image too small (${buffer.length} bytes), likely a placeholder`);
  }

  const filePath = path.join(COVERS_DIR, filename);
  await fsp.writeFile(filePath, buffer);
  return `/img/covers/${filename}`;
}

module.exports = { searchGoogleBooks, searchGoogleBooksMulti, findOrCreateBook, enrichBookMetadata, downloadCover };
