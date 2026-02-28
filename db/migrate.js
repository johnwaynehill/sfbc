'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./index');
const { slugify } = require('../utils/slug');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function migrate() {
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

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`  [migrate] Applying ${file}...`);

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    })();
  }

  // ---------------------------------------------------------------------------
  // Post-migration hooks (idempotent, no-op if already done)
  // ---------------------------------------------------------------------------
  seedUserSlugs();
  seedMonthlyPicks();
}

/**
 * Backfill user_slug for any user that lacks one.
 * Uses slugify() with collision-safe numeric suffix.
 */
function seedUserSlugs() {
  // Guard: column may not exist yet if 008 hasn't been applied
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('user_slug')) return;

  const rows = db.prepare('SELECT id, display_name, email FROM users WHERE user_slug IS NULL').all();
  if (rows.length === 0) return;

  const update = db.prepare('UPDATE users SET user_slug = ? WHERE id = ?');
  const check  = db.prepare('SELECT 1 FROM users WHERE user_slug = ?');

  for (const u of rows) {
    const base = slugify(u.display_name || u.email.split('@')[0]) || 'member';
    let slug = base;
    let n = 2;
    while (check.get(slug)) {
      slug = base + '-' + n++;
    }
    update.run(slug, u.id);
  }

  console.log(`  [migrate] Backfilled slugs for ${rows.length} user(s).`);
}

/**
 * Backfill monthly_picks for every meeting that has a winning_book_id
 * but no monthly_pick_id yet. Idempotent — safe to run on every startup.
 */
function seedMonthlyPicks() {
  // Guard: table may not exist yet if 012 hasn't been applied
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_picks'"
  ).all();
  if (tables.length === 0) return;

  // Guard: meetings must have the monthly_pick_id column
  const cols = db.prepare("PRAGMA table_info(meetings)").all().map(c => c.name);
  if (!cols.includes('monthly_pick_id')) return;

  // Find meetings with a winner but no linked monthly_pick
  const rows = db.prepare(`
    SELECT m.id, m.winning_book_id, m.month_year, m.status, m.created_at,
           n.user_id AS nominator_id
    FROM meetings m
    LEFT JOIN nominations n ON n.meeting_id = m.id AND n.book_id = m.winning_book_id
    WHERE m.winning_book_id IS NOT NULL
      AND m.monthly_pick_id IS NULL
  `).all();

  if (rows.length === 0) return;

  const insertPick = db.prepare(`
    INSERT OR IGNORE INTO monthly_picks (book_id, month_year, status, nominated_by, picked_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const getPickId = db.prepare(
    'SELECT id FROM monthly_picks WHERE book_id = ? AND month_year = ?'
  );
  const linkMeeting = db.prepare(
    'UPDATE meetings SET monthly_pick_id = ? WHERE id = ?'
  );

  db.transaction(() => {
    for (const m of rows) {
      insertPick.run(
        m.winning_book_id,
        m.month_year,
        m.status,        // mirror the meeting's current status
        m.nominator_id || null,
        m.created_at,    // use meeting creation as picked_at
        m.created_at
      );
      const pick = getPickId.get(m.winning_book_id, m.month_year);
      if (pick) {
        linkMeeting.run(pick.id, m.id);
      }
    }
  })();

  console.log(`  [migrate] Backfilled ${rows.length} monthly pick(s).`);
}

module.exports = migrate;
