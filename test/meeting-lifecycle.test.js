'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');

let picksService;
let meetingsService;

describe('meeting lifecycle (advanceMeetingStatus)', () => {
  beforeEach(() => {
    freshDb();
    picksService = require('../services/monthly-picks');
    meetingsService = require('../services/meetings');
  });

  it('transitions scheduled → nominations', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'scheduled' });
    const result = picksService.advanceMeetingStatus(meeting.id, 'nominations');
    assert.ok(!result.error, result.error);
    assert.equal(result.meeting.status, 'nominations');
    assert.ok(result.meeting.nominations_open_at);
  });

  it('transitions nominations → voting (with 2+ nominees)', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const book1 = seedBook({ title: 'Book 1', author: 'Author 1' });
    const book2 = seedBook({ title: 'Book 2', author: 'Author 2' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    const result = picksService.advanceMeetingStatus(meeting.id, 'voting');
    assert.ok(!result.error, result.error);
    assert.equal(result.meeting.status, 'voting');
  });

  it('rejects nominations → voting with fewer than 2 nominees', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);

    const result = picksService.advanceMeetingStatus(meeting.id, 'voting');
    assert.ok(result.error);
    assert.match(result.error, /at least 2 nominees/i);
  });

  it('transitions voting → upcoming (closes voting, determines winner)', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book1 = seedBook({ title: 'Winner Book', author: 'Author W' });
    const book2 = seedBook({ title: 'Loser Book', author: 'Author L' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    seedVote(meeting.id, [book1.id, book2.id], 'fp-1');
    seedVote(meeting.id, [book1.id, book2.id], 'fp-2');

    const result = picksService.advanceMeetingStatus(meeting.id, 'upcoming');
    assert.ok(!result.error, result.error);
    assert.equal(result.meeting.status, 'upcoming');
    assert.equal(result.meeting.winning_book_id, book1.id);
    assert.ok(result.meeting.vote_results_json);

    const voteResults = JSON.parse(result.meeting.vote_results_json);
    assert.equal(voteResults.rankings[0].book_id, book1.id);
  });

  it('rejects voting → upcoming with zero votes', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book1 = seedBook({ title: 'Book 1', author: 'Author 1' });
    const book2 = seedBook({ title: 'Book 2', author: 'Author 2' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    const result = picksService.advanceMeetingStatus(meeting.id, 'upcoming');
    assert.ok(result.error);
    assert.match(result.error, /at least 1 vote/i);
  });

  it('transitions upcoming → reading (requires winning_book_id)', () => {
    const book = seedBook({ title: 'Reading Book', author: 'Author R' });
    const meeting = seedMeeting({ month_year: '2026-07', status: 'upcoming' });
    // Set winning_book_id manually
    db.prepare('UPDATE meetings SET winning_book_id = ? WHERE id = ?').run(book.id, meeting.id);

    const result = picksService.advanceMeetingStatus(meeting.id, 'reading');
    assert.ok(!result.error, result.error);
    assert.equal(result.meeting.status, 'reading');
  });

  it('rejects upcoming → reading without a winning book', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'upcoming' });

    const result = picksService.advanceMeetingStatus(meeting.id, 'reading');
    assert.ok(result.error);
    assert.match(result.error, /without a selected book/i);
  });

  it('rejects invalid transitions', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'scheduled' });

    const result = picksService.advanceMeetingStatus(meeting.id, 'voting');
    assert.ok(result.error);
    assert.match(result.error, /cannot transition/i);
  });

  it('rejects nonexistent meeting', () => {
    const result = picksService.advanceMeetingStatus(99999, 'nominations');
    assert.ok(result.error);
    assert.match(result.error, /not found/i);
  });

  it('only one meeting can be reading at a time', () => {
    const book1 = seedBook({ title: 'Book 1', author: 'Author 1' });
    const book2 = seedBook({ title: 'Book 2', author: 'Author 2' });

    // Set up meeting 1 already in "reading" state
    const meeting1 = seedMeeting({ month_year: '2026-06', status: 'reading' });
    db.prepare('UPDATE meetings SET winning_book_id = ? WHERE id = ?').run(book1.id, meeting1.id);

    // Set up meeting 2 to transition to "reading"
    const meeting2 = seedMeeting({ month_year: '2026-07', status: 'upcoming' });
    db.prepare('UPDATE meetings SET winning_book_id = ? WHERE id = ?').run(book2.id, meeting2.id);

    const result = picksService.advanceMeetingStatus(meeting2.id, 'reading');
    assert.ok(!result.error, result.error);

    // meeting1 should have been moved to "results"
    const m1After = meetingsService.getById(meeting1.id);
    assert.equal(m1After.status, 'results');
  });

  it('creates a monthly_pick when voting closes and no pick exists', () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book1 = seedBook({ title: 'Winner', author: 'Author W' });
    const book2 = seedBook({ title: 'Other', author: 'Author O' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);
    seedVote(meeting.id, [book1.id, book2.id], 'fp-1');

    const result = picksService.advanceMeetingStatus(meeting.id, 'upcoming');
    assert.ok(!result.error, result.error);

    // A monthly pick should now exist
    const pick = picksService.getByMonthYear('2026-07');
    assert.ok(pick, 'Expected a monthly_pick to be created');
    assert.equal(pick.book_id, book1.id);
  });

  it('full lifecycle: scheduled → nominations → voting → upcoming → reading → results', () => {
    const book1 = seedBook({ title: 'Book A', author: 'Author A' });
    const book2 = seedBook({ title: 'Book B', author: 'Author B' });
    const meeting = seedMeeting({ month_year: '2026-08', status: 'scheduled' });

    // scheduled → nominations
    let result = picksService.advanceMeetingStatus(meeting.id, 'nominations');
    assert.ok(!result.error, `scheduled→nominations: ${result.error}`);

    // Add nominees
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    // nominations → voting
    result = picksService.advanceMeetingStatus(meeting.id, 'voting');
    assert.ok(!result.error, `nominations→voting: ${result.error}`);

    // Add votes
    seedVote(meeting.id, [book1.id, book2.id], 'fp-1');
    seedVote(meeting.id, [book1.id, book2.id], 'fp-2');

    // voting → upcoming (determines winner)
    result = picksService.advanceMeetingStatus(meeting.id, 'upcoming');
    assert.ok(!result.error, `voting→upcoming: ${result.error}`);
    assert.equal(result.meeting.winning_book_id, book1.id);

    // upcoming → reading
    result = picksService.advanceMeetingStatus(meeting.id, 'reading');
    assert.ok(!result.error, `upcoming→reading: ${result.error}`);

    // Verify a pick was created and linked
    const pick = picksService.getByMonthYear('2026-08');
    assert.ok(pick, 'Pick should exist');

    // Update the pick to reading so we can advance to results
    // (the pick was created at 'upcoming' during voting→upcoming,
    //  but advanceMeetingStatus already synced it to 'reading')
    const linkedMeeting = meetingsService.getById(meeting.id);
    assert.ok(linkedMeeting.monthly_pick_id, 'Meeting should link to a pick');

    // reading → results (via forceStatus since TRANSITIONS allows it)
    db.prepare("UPDATE meetings SET status = 'reading' WHERE id = ?").run(meeting.id);
    result = picksService.advanceMeetingStatus(meeting.id, 'results');
    assert.ok(!result.error, `reading→results: ${result.error}`);
    assert.equal(result.meeting.status, 'results');
  });
});
