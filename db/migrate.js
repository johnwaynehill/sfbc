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
  // Post-migration: ensure all users have a slug (idempotent, no-op if done)
  // ---------------------------------------------------------------------------
  seedUserSlugs();
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

module.exports = migrate;
