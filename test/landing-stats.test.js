'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedBook } = require('./setup');

let picks;

// Build a vote_results_json payload with `n` balloted nominees.
const rankingsJson = (n) =>
  JSON.stringify({
    rankings: Array.from({ length: n }, (_, i) => ({ book_id: i + 1, rank: i + 1 })),
    voteCount: 5,
  });

function insertPick(monthYear, bookId, { status = 'results', resultsJson = null } = {}) {
  db.prepare(`
    INSERT INTO monthly_picks (book_id, month_year, status, vote_results_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(bookId, monthYear, status, resultsJson);
}

function insertMeetingWithResults(monthYear, n) {
  db.prepare(`
    INSERT INTO meetings (month_year, status, vote_results_json, created_at, updated_at)
    VALUES (?, 'results', ?, datetime('now'), datetime('now'))
  `).run(monthYear, rankingsJson(n));
}

describe('monthly-picks countNominations (historic-inclusive)', () => {
  let book;

  beforeEach(() => {
    freshDb();
    picks = require('../services/monthly-picks');
    book = seedBook({ title: 'Test Book', author: 'Test Author' });
  });

  it('returns 0 when there are no completed picks', () => {
    assert.equal(picks.countNominations(), 0);
  });

  it("sums the rankings array from each pick's vote_results_json", () => {
    insertPick('2025-01', book.id, { resultsJson: rankingsJson(5) });
    insertPick('2025-02', book.id, { resultsJson: rankingsJson(3) });
    assert.equal(picks.countNominations(), 8);
  });

  it('falls back to the meetings row when the pick has no JSON of its own', () => {
    // Historic-style: nominees live only on the meetings row, matched by month_year.
    insertMeetingWithResults('2025-03', 4);
    insertPick('2025-03', book.id, { resultsJson: null });
    assert.equal(picks.countNominations(), 4);
  });

  it('does not double-count when both the pick and meeting have results', () => {
    insertMeetingWithResults('2025-04', 9); // should be ignored in favor of the pick's own JSON
    insertPick('2025-04', book.id, { resultsJson: rankingsJson(6) });
    assert.equal(picks.countNominations(), 6);
  });

  it('ignores picks with no vote results (e.g. still reading)', () => {
    insertPick('2025-05', book.id, { status: 'reading', resultsJson: null });
    assert.equal(picks.countNominations(), 0);
  });
});
