#!/usr/bin/env node
'use strict';

/**
 * seed-users.js — Populate the database with fake test users.
 * Run: node scripts/seed-users.js
 */

const db = require('../db');

const AVATAR_STYLES = [
  'initials', 'identicon', 'rings', 'shapes',
  'lorelei', 'micah', 'miniavs', 'personas', 'notionists',
  'bottts', 'thumbs', 'fun-emoji', 'avataaars', 'pixel-art',
];

const FAKE_USERS = [
  { email: 'alice@example.com', display_name: 'Alice Chen' },
  { email: 'bob@example.com', display_name: 'Bob Martinez' },
  { email: 'carol@example.com', display_name: 'Carol Wright' },
  { email: 'dave@example.com', display_name: 'Dave Patel' },
  { email: 'eve@example.com', display_name: 'Eve Johnson' },
  { email: 'frank@example.com', display_name: 'Frank Nguyen' },
  { email: 'grace@example.com', display_name: 'Grace Kim' },
  { email: 'hank@example.com', display_name: 'Hank Thompson' },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO users (email, display_name, role, avatar_style, created_at)
  VALUES (?, ?, 'member', ?, datetime('now'))
`);

const insertAll = db.transaction(() => {
  let count = 0;
  for (const u of FAKE_USERS) {
    const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    const result = insert.run(u.email, u.display_name, style);
    if (result.changes > 0) count++;
  }
  return count;
});

const added = insertAll();
console.log(`\n  Seeded ${added} fake user(s) (${FAKE_USERS.length - added} already existed).\n`);
