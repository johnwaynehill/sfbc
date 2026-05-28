'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb } = require('./setup');
const config = require('../config');

let books;
const realFetch = global.fetch;

function loadBooks() {
  return require('../services/books');
}

describe('books service — findOrCreateBook', () => {
  beforeEach(() => {
    freshDb();
    config.googleBooksApiKey = ''; // no network for these tests
    books = loadBooks();
  });

  it('creates a new book with slugs', () => {
    const book = books.findOrCreateBook('Dune', 'Frank Herbert');
    assert.equal(book.title, 'Dune');
    assert.equal(book.author, 'Frank Herbert');
    assert.equal(book.author_slug, 'frank-herbert');
    assert.equal(book.title_slug, 'dune');
  });

  it('trims whitespace from title and author', () => {
    const book = books.findOrCreateBook('  Dune  ', '  Frank Herbert  ');
    assert.equal(book.title, 'Dune');
    assert.equal(book.author, 'Frank Herbert');
  });

  it('returns the existing book on exact match (no duplicate)', () => {
    const a = books.findOrCreateBook('Dune', 'Frank Herbert');
    const b = books.findOrCreateBook('Dune', 'Frank Herbert');
    assert.equal(a.id, b.id);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM books').get().n, 1);
  });

  it('matches case-insensitively to avoid duplicates', () => {
    const a = books.findOrCreateBook('Dune', 'Frank Herbert');
    const b = books.findOrCreateBook('dune', 'frank herbert');
    assert.equal(a.id, b.id);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM books').get().n, 1);
  });

  it('dedupes by googleBooksId even when title/author differ', () => {
    const a = books.findOrCreateBook('Dune', 'Frank Herbert', { googleBooksId: 'gb-123' });
    const b = books.findOrCreateBook('Dune: Special Edition', 'F. Herbert', { googleBooksId: 'gb-123' });
    assert.equal(a.id, b.id);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM books').get().n, 1);
  });

  it('stores provided metadata on creation', () => {
    const book = books.findOrCreateBook('Neuromancer', 'William Gibson', {
      googleBooksId: 'gb-neuro',
      isbn: '9780441569595',
      publicationYear: 1984,
      pageCount: 271,
      coverUrl: 'http://example.com/cover.jpg',
    });
    assert.equal(book.google_books_id, 'gb-neuro');
    assert.equal(book.isbn, '9780441569595');
    assert.equal(book.publication_year, 1984);
    assert.equal(book.page_count, 271);
    assert.equal(book.cover_url, 'http://example.com/cover.jpg');
  });

  it('generates a unique title slug when two distinct books collide', () => {
    // Different exact titles that slugify to the same base slug
    const a = books.findOrCreateBook('The Book!', 'Same Author');
    const b = books.findOrCreateBook('The Book', 'Same Author');
    assert.notEqual(a.id, b.id);
    assert.equal(a.title_slug, 'the-book');
    assert.equal(b.title_slug, 'the-book-2'); // suffixed to stay unique
  });
});

describe('books service — search without API key (graceful degradation)', () => {
  beforeEach(() => {
    freshDb();
    config.googleBooksApiKey = '';
    books = loadBooks();
  });

  it('searchGoogleBooks returns null', async () => {
    assert.equal(await books.searchGoogleBooks('Dune', 'Herbert'), null);
  });

  it('searchGoogleBooksMulti returns an empty array', async () => {
    assert.deepEqual(await books.searchGoogleBooksMulti('dune'), []);
  });

  it('searchGoogleBooksMulti returns [] for queries shorter than 3 chars', async () => {
    assert.deepEqual(await books.searchGoogleBooksMulti('du'), []);
  });
});

describe('books service — search with mocked fetch', () => {
  beforeEach(() => {
    freshDb();
    config.googleBooksApiKey = 'test-key';
    books = loadBooks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('parses a Google Books volume into a normalized result', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        items: [{
          id: 'vol-1',
          volumeInfo: {
            title: 'Dune',
            authors: ['Frank Herbert'],
            publishedDate: '1965-08-01',
            pageCount: 412,
            description: 'A <b>desert</b> planet epic.',
            publisher: 'Chilton',
            language: 'en',
            categories: ['Science Fiction'],
            industryIdentifiers: [
              { type: 'ISBN_10', identifier: '0441172717' },
              { type: 'ISBN_13', identifier: '9780441172719' },
            ],
          },
        }],
      }),
    });

    const result = await books.searchGoogleBooks('Dune', 'Frank Herbert');
    assert.equal(result.googleBooksId, 'vol-1');
    assert.equal(result.title, 'Dune');
    assert.equal(result.author, 'Frank Herbert');
    assert.equal(result.publicationYear, 1965); // parsed from publishedDate
    assert.equal(result.pageCount, 412);
    assert.equal(result.isbn, '9780441172719'); // prefers ISBN_13
    assert.equal(result.description, 'A desert planet epic.'); // HTML stripped
    assert.match(result.coverUrl, /vol-1/);
  });

  it('returns null when the API responds with no items', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ items: [] }) });
    assert.equal(await books.searchGoogleBooks('Nope', 'Nobody'), null);
  });

  it('returns null when the API request is not ok', async () => {
    global.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    assert.equal(await books.searchGoogleBooks('Dune', 'Herbert'), null);
  });

  it('returns null when fetch throws (network error)', async () => {
    global.fetch = async () => { throw new Error('network down'); };
    assert.equal(await books.searchGoogleBooks('Dune', 'Herbert'), null);
  });

  it('searchGoogleBooksMulti maps multiple results', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        items: [
          { id: 'a', volumeInfo: { title: 'Book A', authors: ['Author A'], publishedDate: '2001' } },
          { id: 'b', volumeInfo: { title: 'Book B', authors: ['Author B'], publishedDate: '2010-03' } },
        ],
      }),
    });

    const results = await books.searchGoogleBooksMulti('sci-fi');
    assert.equal(results.length, 2);
    assert.equal(results[0].title, 'Book A');
    assert.equal(results[0].year, 2001);
    assert.equal(results[1].year, 2010);
  });
});
