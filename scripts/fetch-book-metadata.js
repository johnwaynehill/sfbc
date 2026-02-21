'use strict';

/**
 * fetch-book-metadata.js — Enrich books with description and subjects/genres.
 *
 * Iterates all books missing description data and fetches from:
 * 1. Google Books API (description + categories)
 * 2. Open Library API (subjects, fallback description)
 *
 * Usage: node scripts/fetch-book-metadata.js
 */

const db = require('../db');
const migrate = require('../db/migrate');
const config = require('../config');

// Run migrations to ensure description/subjects columns exist
migrate();

const API_KEY = config.googleBooksApiKey;
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Google Books API                                                   */
/* ------------------------------------------------------------------ */

async function fetchGoogleBooks(title, author, googleBooksId) {
  if (!API_KEY) return null;

  try {
    let info = null;

    // If we have an ID, fetch directly
    if (googleBooksId) {
      const url = `https://www.googleapis.com/books/v1/volumes/${googleBooksId}?key=${API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        info = data.volumeInfo || null;
      }
    }

    // Otherwise, search
    if (!info) {
      const query = `intitle:${title}+inauthor:${author}`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.items || data.items.length === 0) return null;

      const vol = data.items[0];
      info = vol.volumeInfo || {};
      googleBooksId = vol.id;
    }

    let description = null;
    if (info.description) {
      description = info.description.replace(/<[^>]+>/g, '').trim();
    }

    return {
      googleBooksId,
      description,
      categories: info.categories || [],
    };
  } catch (err) {
    console.warn(`  [google] Error: ${err.message}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Open Library API                                                   */
/* ------------------------------------------------------------------ */

async function fetchOpenLibrary(title, author) {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1&fields=key,subject`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

    const doc = data.docs[0];
    const subjects = (doc.subject || [])
      .filter(s => s.length < 40)
      .slice(0, 10);

    let description = null;
    if (doc.key) {
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

    return { subjects, description };
  } catch (err) {
    console.warn(`  [openlibrary] Error: ${err.message}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const books = db.prepare(
    'SELECT * FROM books WHERE description IS NULL OR subjects IS NULL'
  ).all();

  console.log(`\n  Found ${books.length} books needing metadata enrichment.\n`);

  if (API_KEY) {
    console.log('  Google Books API key configured — using as primary source.');
  } else {
    console.log('  No Google Books API key — using Open Library only.');
  }
  console.log('');

  const updateStmt = db.prepare(`
    UPDATE books SET
      description = COALESCE(?, description),
      subjects = COALESCE(?, subjects),
      google_books_id = COALESCE(?, google_books_id),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  let enriched = 0;
  let skipped = 0;

  for (const book of books) {
    console.log(`  [fetch] "${book.title}" by ${book.author}...`);

    let description = null;
    let subjects = [];
    let googleBooksId = book.google_books_id;

    // Google Books
    const gb = await fetchGoogleBooks(book.title, book.author, book.google_books_id);
    if (gb) {
      description = gb.description;
      subjects = gb.categories || [];
      googleBooksId = gb.googleBooksId;
    }

    await sleep(DELAY_MS);

    // Open Library (supplement subjects, fallback description)
    const ol = await fetchOpenLibrary(book.title, book.author);
    if (ol) {
      if (!description && ol.description) {
        description = ol.description;
      }
      if (ol.subjects && ol.subjects.length > 0) {
        const combined = new Set([...subjects, ...ol.subjects]);
        subjects = [...combined].slice(0, 10);
      }
    }

    if (description || subjects.length > 0) {
      updateStmt.run(
        description || null,
        subjects.length > 0 ? JSON.stringify(subjects) : null,
        googleBooksId || null,
        book.id
      );
      console.log(`  [done]  ${description ? 'desc' : 'no desc'}, ${subjects.length} subjects`);
      enriched++;
    } else {
      console.log(`  [skip]  No metadata found`);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n  Results: ${enriched} enriched, ${skipped} skipped.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
