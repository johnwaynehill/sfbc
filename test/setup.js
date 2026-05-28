'use strict';

/**
 * Test harness — creates a fresh in-memory SQLite database, runs all
 * migrations, and patches the `db` module in the require cache so that
 * service modules use the test database instead of the on-disk one.
 *
 * Usage:
 *   const { db, freshDb } = require('./setup');
 *   // `db` is the current in-memory database
 *   // `freshDb()` resets the database (drops all data, reruns migrations)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Run all migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    })();
    db.pragma('foreign_keys = ON');
  }

  return db;
}

// --- Patch the db module in the require cache ---

// First, resolve the real db module path
const dbModulePath = require.resolve('../db');

// Create the initial test database
let testDb = createTestDb();

// Replace the db module's exports with our test database.
// We use a Proxy so that any property access (prepare, exec, transaction, etc.)
// is forwarded to the current testDb instance.
const dbProxy = new Proxy({}, {
  get(_, prop) {
    if (prop === '__testDb') return testDb;
    const val = testDb[prop];
    if (typeof val === 'function') return val.bind(testDb);
    return val;
  },
  set(_, prop, value) {
    testDb[prop] = value;
    return true;
  },
});

// Inject before any service module loads
require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: dbProxy,
};

// Also patch the config module so it doesn't try to load .env or real config
const configModulePath = require.resolve('../config');
require.cache[configModulePath] = {
  id: configModulePath,
  filename: configModulePath,
  loaded: true,
  exports: {
    port: 3000,
    nodeEnv: 'test',
    sessionSecret: 'test-secret',
    appUrl: 'http://localhost:3000',
    databasePath: ':memory:',
    bootstrapKey: 'test-bootstrap-key',
    googleBooksApiKey: '',
    superAdminEmail: 'admin@test.com',
    smtp: { host: '', port: 465, secure: true, user: '', pass: '', from: '' },
    club: { name: 'Test Book Club', tagline: 'Testing', meetupUrl: '' },
    sentry: { dsn: '' },
    posthog: { apiKey: '', host: '' },
  },
};

/**
 * Reset the database: close the old one, create a fresh in-memory DB,
 * and clear require cache for all service modules so they re-prepare
 * statements against the new DB.
 */
function freshDb() {
  try { testDb.close(); } catch (_) { /* already closed */ }
  testDb = createTestDb();

  // Clear cached service/middleware modules so they re-require `db`
  // and call db.prepare() again — this time hitting our new testDb via the proxy
  const projectRoot = path.join(__dirname, '..');
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(projectRoot) && !key.includes('node_modules') && key !== dbModulePath && key !== configModulePath && !key.startsWith(path.join(__dirname, ''))) {
      delete require.cache[key];
    }
  }
}

// --- Seed helpers ---

function seedUser({ email = 'alice@test.com', display_name = 'Alice', role = 'member', password_hash = null } = {}) {
  const slug = display_name.toLowerCase().replace(/\s+/g, '-');
  const info = testDb.prepare(`
    INSERT INTO users (email, display_name, role, password_hash, user_slug, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(email, display_name, role, password_hash, slug);
  return testDb.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function seedBook({ title = 'Test Book', author = 'Test Author', cover_url = null } = {}) {
  const authorSlug = author.toLowerCase().replace(/\s+/g, '-');
  const titleSlug = title.toLowerCase().replace(/\s+/g, '-');
  const info = testDb.prepare(`
    INSERT INTO books (title, author, cover_url, author_slug, title_slug, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(title, author, cover_url, authorSlug, titleSlug);
  return testDb.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
}

function seedMeeting({ month_year = '2026-06', status = 'scheduled' } = {}) {
  const info = testDb.prepare(`
    INSERT INTO meetings (month_year, status, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `).run(month_year, status);
  return testDb.prepare('SELECT * FROM meetings WHERE id = ?').get(info.lastInsertRowid);
}

function seedNominee(meetingId, bookId, { userId = null, reason = null, nominator_name = null } = {}) {
  testDb.prepare(`
    INSERT OR IGNORE INTO meeting_nominees (meeting_id, book_id, source) VALUES (?, ?, 'admin_add')
  `).run(meetingId, bookId);
  if (userId || reason || nominator_name) {
    testDb.prepare(`
      INSERT OR IGNORE INTO nominations (meeting_id, book_id, user_id, reason, nominator_name, submitted_fingerprint, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(meetingId, bookId, userId, reason, nominator_name, 'fp-seed-' + Math.random());
  }
}

function seedVote(meetingId, rankingBookIds, fingerprint = 'fp-test-' + Math.random()) {
  testDb.prepare(`
    INSERT INTO votes (meeting_id, ranking_json, submitted_fingerprint, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(meetingId, JSON.stringify(rankingBookIds), fingerprint);
}

function seedReview(bookId, userId, { grade = 'A', body = 'A review', has_spoilers = 0, did_finish = 1 } = {}) {
  const info = testDb.prepare(`
    INSERT INTO reviews (book_id, user_id, grade, body_markdown, has_spoilers, did_finish, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(bookId, userId, grade, body, has_spoilers ? 1 : 0, did_finish ? 1 : 0);
  return testDb.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = {
  get db() { return dbProxy; },
  freshDb,
  seedUser,
  seedBook,
  seedMeeting,
  seedNominee,
  seedVote,
  seedReview,
};
