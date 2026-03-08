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

    // Disable foreign keys during migrations to prevent CASCADE deletes
    // when migrations drop and recreate parent tables (e.g. meetings).
    // SQLite requires this OUTSIDE a transaction.
    db.pragma('foreign_keys = OFF');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    })();

    // Re-enable and verify referential integrity
    db.pragma('foreign_keys = ON');
    const fkErrors = db.pragma('foreign_key_check');
    if (fkErrors.length > 0) {
      console.warn(`  [migrate] ⚠ FK violations after ${file}:`, fkErrors);
    }
  }

  // ---------------------------------------------------------------------------
  // Post-migration hooks (idempotent, no-op if already done)
  // ---------------------------------------------------------------------------
  seedUserSlugs();
  seedMonthlyPicks();
  seedPicksLifecycle();
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

/**
 * Backfill lifecycle columns on monthly_picks from their linked meetings.
 * Also creates events rows from meeting scheduling data.
 * Idempotent — safe to run on every startup.
 */
function seedPicksLifecycle() {
  // Guard: monthly_picks must have the new columns (migration 015)
  const cols = db.prepare("PRAGMA table_info(monthly_picks)").all().map(c => c.name);
  if (!cols.includes('nominations_open_at')) return;

  // Guard: events table must exist
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='events'"
  ).all();
  if (tables.length === 0) return;

  // --- 1. Copy lifecycle timestamps from meetings → monthly_picks ---
  const picksNeedingTimestamps = db.prepare(`
    SELECT mp.id AS pick_id,
           m.nominations_open_at, m.nominations_close_at,
           m.voting_open_at, m.voting_close_at,
           m.vote_results_json
    FROM monthly_picks mp
    JOIN meetings m ON m.monthly_pick_id = mp.id
    WHERE mp.nominations_open_at IS NULL
      AND m.nominations_open_at IS NOT NULL
  `).all();

  if (picksNeedingTimestamps.length > 0) {
    const updatePickTimestamps = db.prepare(`
      UPDATE monthly_picks
      SET nominations_open_at = ?,
          nominations_close_at = ?,
          voting_open_at = ?,
          voting_close_at = ?,
          vote_results_json = ?
      WHERE id = ?
    `);

    db.transaction(() => {
      for (const row of picksNeedingTimestamps) {
        updatePickTimestamps.run(
          row.nominations_open_at,
          row.nominations_close_at,
          row.voting_open_at,
          row.voting_close_at,
          row.vote_results_json,
          row.pick_id
        );
      }
    })();

    console.log(`  [migrate] Backfilled timestamps for ${picksNeedingTimestamps.length} pick(s).`);
  }

  // --- 2. Create events from meetings that have scheduling data ---
  const meetingsNeedingEvents = db.prepare(`
    SELECT m.id AS meeting_id, m.monthly_pick_id,
           m.meeting_time, m.location_text, m.meetup_event_url
    FROM meetings m
    WHERE m.monthly_pick_id IS NOT NULL
      AND (m.meeting_time IS NOT NULL OR m.location_text IS NOT NULL OR m.meetup_event_url IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM events e WHERE e.monthly_pick_id = m.monthly_pick_id
      )
  `).all();

  if (meetingsNeedingEvents.length > 0) {
    const insertEvent = db.prepare(`
      INSERT INTO events (monthly_pick_id, meeting_time, location_text, meetup_event_url)
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const m of meetingsNeedingEvents) {
        insertEvent.run(
          m.monthly_pick_id,
          m.meeting_time,
          m.location_text,
          m.meetup_event_url
        );
      }
    })();

    console.log(`  [migrate] Created ${meetingsNeedingEvents.length} event(s) from meetings.`);
  }
}

module.exports = migrate;
