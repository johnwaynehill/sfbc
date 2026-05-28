'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { slugify, generateSlug, bookPath } = require('../utils/slug');
const {
  formatMonthYear, formatStatus, monthYearSlug, parseMonthYearSlug,
  formatMeetingTime, timeAgo,
} = require('../utils/format');

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  it('strips special characters', () => {
    assert.equal(slugify("It's a Test!"), 'its-a-test');
  });

  it('collapses multiple hyphens', () => {
    assert.equal(slugify('a---b'), 'a-b');
  });

  it('trims leading/trailing hyphens', () => {
    assert.equal(slugify('--hello--'), 'hello');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    assert.equal(slugify(long).length, 80);
  });

  it('handles empty/null input', () => {
    assert.equal(slugify(''), '');
    assert.equal(slugify(null), '');
    assert.equal(slugify(undefined), '');
  });
});

describe('generateSlug', () => {
  it('combines title and author', () => {
    assert.equal(generateSlug('Dune', 'Frank Herbert'), 'dune-frank-herbert');
  });

  it('handles title only', () => {
    assert.equal(generateSlug('Dune', ''), 'dune');
  });
});

describe('bookPath', () => {
  it('generates /books/:authorSlug/:titleSlug', () => {
    assert.equal(bookPath('Dune', 'Frank Herbert'), '/books/frank-herbert/dune');
  });
});

describe('formatMonthYear', () => {
  it('converts YYYY-MM to "Month Year"', () => {
    assert.equal(formatMonthYear('2026-01'), 'January 2026');
    assert.equal(formatMonthYear('2026-12'), 'December 2026');
  });

  it('handles null/empty', () => {
    assert.equal(formatMonthYear(''), '');
    assert.equal(formatMonthYear(null), '');
  });
});

describe('formatStatus', () => {
  it('maps status keys to labels', () => {
    assert.equal(formatStatus('reading'), 'Currently Reading');
    assert.equal(formatStatus('nominations'), 'Nominations Open');
    assert.equal(formatStatus('results'), 'Finished');
  });

  it('returns unknown status as-is', () => {
    assert.equal(formatStatus('mystery'), 'mystery');
  });
});

describe('monthYearSlug / parseMonthYearSlug', () => {
  it('round-trips correctly', () => {
    assert.equal(monthYearSlug('2026-01'), 'january-2026');
    assert.equal(parseMonthYearSlug('january-2026'), '2026-01');
  });

  it('handles all 12 months', () => {
    for (let m = 1; m <= 12; m++) {
      const my = `2026-${String(m).padStart(2, '0')}`;
      const slug = monthYearSlug(my);
      assert.ok(slug, `Slug for ${my} should exist`);
      assert.equal(parseMonthYearSlug(slug), my, `Round-trip failed for ${my}`);
    }
  });

  it('returns null for invalid slug', () => {
    assert.equal(parseMonthYearSlug('not-a-month-2026'), null);
    assert.equal(parseMonthYearSlug(''), null);
    assert.equal(parseMonthYearSlug(null), null);
  });
});

describe('formatMeetingTime', () => {
  it('formats long style (default)', () => {
    const result = formatMeetingTime('2026-02-25T18:30');
    assert.match(result, /Feb 25 at 6:30 PM/);
  });

  it('formats short style', () => {
    const result = formatMeetingTime('2026-02-25T18:30', 'short');
    assert.match(result, /Feb 25/);
    assert.ok(!result.includes('PM'));
  });

  it('formats time style', () => {
    const result = formatMeetingTime('2026-02-25T18:30', 'time');
    assert.equal(result, '6:30 PM');
  });

  it('formats noon correctly', () => {
    const result = formatMeetingTime('2026-02-25T12:00', 'time');
    assert.equal(result, '12 PM');
  });

  it('formats midnight correctly', () => {
    const result = formatMeetingTime('2026-02-25T00:00', 'time');
    assert.equal(result, '12 AM');
  });

  it('omits minutes when they are zero', () => {
    const result = formatMeetingTime('2026-02-25T14:00', 'time');
    assert.equal(result, '2 PM');
  });

  it('returns empty string for null/empty', () => {
    assert.equal(formatMeetingTime(''), '');
    assert.equal(formatMeetingTime(null), '');
  });
});

describe('timeAgo', () => {
  it('returns empty for null', () => {
    assert.equal(timeAgo(null), '');
    assert.equal(timeAgo(''), '');
  });

  it('returns empty for invalid date', () => {
    assert.equal(timeAgo('not-a-date'), '');
  });
});
