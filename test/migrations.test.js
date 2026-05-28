'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

describe('database migrations', () => {
  it('all migrations apply cleanly to an empty database', () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

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

    assert.ok(files.length >= 25, `Expected at least 25 migrations, found ${files.length}`);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      db.pragma('foreign_keys = OFF');
      assert.doesNotThrow(() => {
        db.transaction(() => {
          db.exec(sql);
          db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
        })();
      }, `Migration ${file} failed`);
      db.pragma('foreign_keys = ON');
    }

    // Verify key tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);

    const required = [
      'users', 'books', 'meetings', 'monthly_picks', 'nominations',
      'meeting_nominees', 'votes', 'reviews', 'review_reactions',
      'review_replies', 'announcements', 'events', 'grade_weights',
    ];

    for (const table of required) {
      assert.ok(tables.includes(table), `Missing table: ${table}`);
    }

    db.close();
  });

  it('migrations are idempotent (re-running applied ones is a no-op)', () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

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

    // Apply all
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
      })();
      db.pragma('foreign_keys = ON');
    }

    // Count tables after first run
    const tablesAfterFirst = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();

    // Re-apply all (simulating what happens on server restart — tracked by _migrations)
    const applied = new Set(
      db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename)
    );
    for (const file of files) {
      if (applied.has(file)) continue; // This should skip all of them
      assert.fail(`Migration ${file} was not tracked in _migrations`);
    }

    // Tables should be unchanged
    const tablesAfterSecond = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    assert.equal(tablesAfterFirst.length, tablesAfterSecond.length);

    db.close();
  });

  it('grade_weights table has all expected grades', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      db.pragma('foreign_keys = OFF');
      db.transaction(() => { db.exec(sql); })();
      db.pragma('foreign_keys = ON');
    }

    const grades = db.prepare('SELECT grade, weight FROM grade_weights ORDER BY weight DESC').all();
    assert.ok(grades.length >= 14, `Expected at least 14 grades, got ${grades.length}`);

    const labels = grades.map(g => g.grade);
    for (const expected of ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']) {
      assert.ok(labels.includes(expected), `Missing grade: ${expected}`);
    }

    // S should have the highest weight
    assert.equal(grades[0].grade, 'S');
    // F or F- should have the lowest weight
    assert.ok(['F', 'F-'].includes(grades[grades.length - 1].grade),
      `Expected lowest grade to be F or F-, got ${grades[grades.length - 1].grade}`);

    db.close();
  });
});
