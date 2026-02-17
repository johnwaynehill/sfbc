'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { slugify } = require('../utils/slug');

const COVERS_DIR = path.join(__dirname, '..', 'public', 'img', 'covers');
const API_KEY = config.googleBooksApiKey;
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Google Books API                                                   */
/* ------------------------------------------------------------------ */

async function searchGoogleBooks(title, author) {
  if (!API_KEY) return null;

  const query = `intitle:${title}+inauthor:${author}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  [google] HTTP ${res.status} for "${title}"`);
      return null;
    }
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

    // zoom=0 gives the full-size, uncropped cover
    const coverImageUrl = `https://books.google.com/books/content?id=${vol.id}&printsec=frontcover&img=1&zoom=0&source=gbs_api`;

    return {
      googleBooksId: vol.id,
      isbn,
      publicationYear,
      pageCount: info.pageCount || null,
      coverImageUrl,
    };
  } catch (err) {
    console.warn(`  [google] Error for "${title}":`, err.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Open Library API (fallback)                                        */
/* ------------------------------------------------------------------ */

async function searchOpenLibrary(title, author) {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1&fields=key,cover_i,isbn,number_of_pages_median,first_publish_year`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  [openlibrary] HTTP ${res.status} for "${title}"`);
      return null;
    }
    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

    const doc = data.docs[0];
    if (!doc.cover_i) return null;

    const olid = doc.key ? doc.key.split('/').pop() : null;

    // Pick first ISBN_13 if available
    let isbn = null;
    if (doc.isbn && doc.isbn.length > 0) {
      isbn = doc.isbn.find(i => i.length === 13) || doc.isbn[0];
    }

    return {
      openLibraryId: olid,
      isbn,
      publicationYear: doc.first_publish_year || null,
      pageCount: doc.number_of_pages_median || null,
      coverImageUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
    };
  } catch (err) {
    console.warn(`  [openlibrary] Error for "${title}":`, err.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Image download                                                     */
/* ------------------------------------------------------------------ */

async function downloadImage(url, filePath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  // Google Books returns placeholder images for missing covers:
  // - A tiny 1x1 GIF (~43 bytes)
  // - A grey "image not available" PNG (~8.9KB, exactly 575x750, greyscale)
  // Reject anything under 15KB as likely a placeholder
  if (buffer.length < 15000) {
    throw new Error(`Image too small (${buffer.length} bytes), likely a placeholder`);
  }

  await fsp.writeFile(filePath, buffer);
  return { size: buffer.length };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  await fsp.mkdir(COVERS_DIR, { recursive: true });

  const books = db.prepare('SELECT * FROM books').all();
  console.log(`\n  Found ${books.length} books to process.\n`);

  if (API_KEY) {
    console.log('  Google Books API key configured — using as primary source.');
  } else {
    console.log('  No Google Books API key — using Open Library only.');
  }
  console.log('');

  const updateBook = db.prepare(`
    UPDATE books SET
      cover_url = COALESCE(?, cover_url),
      google_books_id = COALESCE(?, google_books_id),
      open_library_id = COALESCE(?, open_library_id),
      isbn = COALESCE(?, isbn),
      publication_year = COALESCE(?, publication_year),
      page_count = COALESCE(?, page_count),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    const authorSlug = book.author_slug || slugify(book.author);
    const titleSlug = book.title_slug || slugify(book.title);
    const baseFilename = `${authorSlug}_${titleSlug}`;
    const filePath = path.join(COVERS_DIR, `${baseFilename}.jpg`);

    // Skip if already has a local cover on disk
    if (book.cover_url && book.cover_url.startsWith('/img/covers/') && fs.existsSync(filePath)) {
      console.log(`  [skip] "${book.title}" — already has local cover`);
      skipped++;
      continue;
    }

    console.log(`  [fetch] "${book.title}" by ${book.author}...`);

    // Try Google Books first, then Open Library
    let result = await searchGoogleBooks(book.title, book.author);
    let source = 'google';

    if (!result) {
      await sleep(DELAY_MS);
      result = await searchOpenLibrary(book.title, book.author);
      source = 'openlibrary';
    }

    if (!result) {
      console.warn(`  [miss]  No cover found for "${book.title}"`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    // Download the image
    try {
      const { size } = await downloadImage(result.coverImageUrl, filePath);
      const localPath = `/img/covers/${baseFilename}.jpg`;

      updateBook.run(
        localPath,
        result.googleBooksId || null,
        result.openLibraryId || null,
        result.isbn || null,
        result.publicationYear || null,
        result.pageCount || null,
        book.id
      );

      console.log(`  [done]  ${source} — ${(size / 1024).toFixed(1)}KB → ${localPath}`);
      enriched++;
    } catch (err) {
      console.warn(`  [fail]  "${book.title}" — ${err.message}`);

      // If Google failed, try Open Library as image-only fallback
      if (source === 'google') {
        try {
          const olResult = await searchOpenLibrary(book.title, book.author);
          if (olResult) {
            const { size } = await downloadImage(olResult.coverImageUrl, filePath);
            const localPath = `/img/covers/${baseFilename}.jpg`;

            updateBook.run(
              localPath,
              result.googleBooksId || null,
              olResult.openLibraryId || null,
              result.isbn || olResult.isbn || null,
              result.publicationYear || olResult.publicationYear || null,
              result.pageCount || olResult.pageCount || null,
              book.id
            );

            console.log(`  [done]  openlibrary (fallback) — ${(size / 1024).toFixed(1)}KB → ${localPath}`);
            enriched++;
            await sleep(DELAY_MS);
            continue;
          }
        } catch (err2) {
          console.warn(`  [fail]  Open Library fallback also failed: ${err2.message}`);
        }
      }

      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n  Results: ${enriched} enriched, ${skipped} skipped, ${failed} failed.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
