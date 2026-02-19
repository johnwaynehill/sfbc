'use strict';

const db = require('../db');
const migrate = require('../db/migrate');
const meetings = require('../data/historical-meetings.json');
const { slugify } = require('../utils/slug');

// Ensure tables exist (runs 002-add-book-slugs.sql if needed)
migrate();

const insertBook = db.prepare(`
  INSERT OR IGNORE INTO books (title, author, author_slug, title_slug) VALUES (?, ?, ?, ?)
`);

const findBook = db.prepare(`
  SELECT id FROM books WHERE title = ? AND author = ?
`);

const checkMeetingWithWinner = db.prepare(`
  SELECT id FROM meetings WHERE month_year = ? AND winning_book_id = ?
`);

const checkMeetingByMonth = db.prepare(`
  SELECT id FROM meetings WHERE month_year = ?
`);

const insertMeeting = db.prepare(`
  INSERT INTO meetings (month_year, meeting_time, location_text, meetup_event_url, status, winning_book_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Backfill slugs for any existing books missing them
const backfillSlugs = db.prepare(`
  UPDATE books SET author_slug = ?, title_slug = ? WHERE id = ? AND (author_slug IS NULL OR title_slug IS NULL)
`);

// Fix known author name corrections in existing data
const authorCorrections = [
  { title: 'The Mountain in the Sea', oldAuthor: 'Ray Naylor', newAuthor: 'Ray Nayler' },
];

const fixAuthor = db.prepare(`
  UPDATE books SET author = ?, author_slug = ? WHERE title = ? AND author = ?
`);

for (const fix of authorCorrections) {
  const result = fixAuthor.run(fix.newAuthor, slugify(fix.newAuthor), fix.title, fix.oldAuthor);
  if (result.changes > 0) {
    console.log(`  [fix] Corrected author: "${fix.oldAuthor}" → "${fix.newAuthor}" for "${fix.title}"`);
  }
}

const seedAll = db.transaction(() => {
  let inserted = 0;
  let skipped = 0;

  for (const m of meetings) {
    const status = m.status || 'results';
    const isUpcoming = status !== 'results';

    insertBook.run(m.title, m.author, slugify(m.author), slugify(m.title));
    const book = findBook.get(m.title, m.author);

    // Backfill slugs if book already existed without them
    backfillSlugs.run(slugify(m.author), slugify(m.title), book.id);

    // For past meetings, check by month_year + winning_book_id
    // For upcoming meetings (no winner), check by month_year only
    const existing = isUpcoming
      ? checkMeetingByMonth.get(m.monthYear)
      : checkMeetingWithWinner.get(m.monthYear, book.id);
    if (existing) {
      skipped++;
      continue;
    }

    insertMeeting.run(
      m.monthYear,
      m.meetingTime || null,
      m.locationText || null,
      m.meetupEventUrl || null,
      status,
      book.id
    );

    inserted++;
    console.log(`  [seed] ${m.monthYear} — "${m.title}" by ${m.author} [${status}]`);
  }

  console.log(`\n  Seeded ${inserted} meetings, skipped ${skipped} already existing.\n`);
});

seedAll();
