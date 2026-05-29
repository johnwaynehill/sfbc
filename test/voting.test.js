'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');

// seededShuffle is a pure function — safe to import once
const { seededShuffle } = require('../services/voting');

let voting;

describe('seededShuffle', () => {
  it('produces deterministic order for the same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, 'user-42');
    const b = seededShuffle(items, 'user-42');
    assert.deepEqual(a, b);
  });

  it('produces different order for different seeds', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, 'alice');
    const b = seededShuffle(items, 'bob');
    assert.notDeepEqual(a, b);
  });

  it('does not mutate the original array', () => {
    const items = [1, 2, 3];
    seededShuffle(items, 'x');
    assert.deepEqual(items, [1, 2, 3]);
  });

  it('returns all original elements (no loss/duplication)', () => {
    const items = [10, 20, 30, 40, 50];
    const shuffled = seededShuffle(items, 'test');
    assert.equal(shuffled.length, items.length);
    assert.deepEqual([...shuffled].sort((a, b) => a - b), [...items].sort((a, b) => a - b));
  });

  it('handles empty array', () => {
    assert.deepEqual(seededShuffle([], 'x'), []);
  });

  it('handles single element', () => {
    assert.deepEqual(seededShuffle([42], 'x'), [42]);
  });
});

describe('getNomineesForBallot', () => {
  beforeEach(() => {
    freshDb();
    voting = require('../services/voting');
  });

  it('returns nominees with book and nomination metadata', () => {
    const user = seedUser();
    const book = seedBook({ title: 'Dune', author: 'Frank Herbert' });
    const meeting = seedMeeting({ month_year: '2026-06', status: 'voting' });
    seedNominee(meeting.id, book.id, { userId: user.id, reason: 'Classic sci-fi' });

    const nominees = voting.getNomineesForBallot(meeting.id);

    assert.equal(nominees.length, 1);
    assert.equal(nominees[0].title, 'Dune');
    assert.equal(nominees[0].author, 'Frank Herbert');
    assert.equal(nominees[0].reason, 'Classic sci-fi');
    assert.equal(nominees[0].nominator_name, 'Alice');
    assert.equal(nominees[0].book_id, book.id);
  });

  it('returns empty array for meeting with no nominees', () => {
    const meeting = seedMeeting();
    assert.deepEqual(voting.getNomineesForBallot(meeting.id), []);
  });

  it('returns multiple nominees in insertion order', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book1 = seedBook({ title: 'Book A', author: 'Author A' });
    const book2 = seedBook({ title: 'Book B', author: 'Author B' });
    const book3 = seedBook({ title: 'Book C', author: 'Author C' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);
    seedNominee(meeting.id, book3.id);

    const nominees = voting.getNomineesForBallot(meeting.id);
    assert.equal(nominees.length, 3);
    assert.equal(nominees[0].title, 'Book A');
    assert.equal(nominees[1].title, 'Book B');
    assert.equal(nominees[2].title, 'Book C');
  });
});

describe('hasVoted', () => {
  beforeEach(() => {
    freshDb();
    voting = require('../services/voting');
  });

  it('returns false when no votes exist', () => {
    const meeting = seedMeeting();
    assert.equal(voting.hasVoted(meeting.id, 'fp-123'), false);
  });

  it('returns true after a vote is submitted', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-alice');

    assert.equal(voting.hasVoted(meeting.id, 'fp-alice'), true);
  });

  it('returns false for a different fingerprint', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-alice');

    assert.equal(voting.hasVoted(meeting.id, 'fp-bob'), false);
  });
});

describe('hasUserVoted', () => {
  beforeEach(() => {
    freshDb();
    voting = require('../services/voting');
  });

  it('returns false when no votes exist', () => {
    const user = seedUser();
    const meeting = seedMeeting();
    assert.equal(voting.hasUserVoted(meeting.id, user.id), false);
  });

  it('returns true after the user votes (regardless of fingerprint)', () => {
    const user = seedUser();
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-some-browser', user.id);

    assert.equal(voting.hasUserVoted(meeting.id, user.id), true);
  });

  it('returns false for a different user', () => {
    const alice = seedUser({ email: 'alice@test.com', display_name: 'Alice' });
    const bob = seedUser({ email: 'bob@test.com', display_name: 'Bob' });
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-alice', alice.id);

    assert.equal(voting.hasUserVoted(meeting.id, bob.id), false);
  });

  it('returns false for a null/anonymous userId', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-anon', null);

    assert.equal(voting.hasUserVoted(meeting.id, null), false);
    assert.equal(voting.hasUserVoted(meeting.id, undefined), false);
  });
});

describe('getVoteCount', () => {
  beforeEach(() => {
    freshDb();
    voting = require('../services/voting');
  });

  it('returns 0 with no votes', () => {
    const meeting = seedMeeting();
    assert.equal(voting.getVoteCount(meeting.id), 0);
  });

  it('counts all votes for a meeting', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-1');
    seedVote(meeting.id, [book.id], 'fp-2');
    seedVote(meeting.id, [book.id], 'fp-3');

    assert.equal(voting.getVoteCount(meeting.id), 3);
  });
});

describe('getVotesForMeeting — IP clustering', () => {
  beforeEach(() => {
    freshDb();
    voting = require('../services/voting');
  });

  it('flags votes that share an IP hash with a cluster count > 1', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    // Two votes from the same network (same ip hash), one from another.
    seedVote(meeting.id, [book.id], 'fp-1', null, 'aaaaaa0000');
    seedVote(meeting.id, [book.id], 'fp-2', null, 'aaaaaa0000');
    seedVote(meeting.id, [book.id], 'fp-3', null, 'bbbbbb1111');

    const votes = voting.getVotesForMeeting(meeting.id);
    const shared = votes.filter(v => v.submitted_ip_hash === 'aaaaaa0000');
    const lone = votes.find(v => v.submitted_ip_hash === 'bbbbbb1111');

    assert.equal(shared.length, 2);
    assert.ok(shared.every(v => v.ip_cluster_count === 2));
    assert.ok(shared.every(v => v.network_label === 'aaaaaa'));
    assert.equal(lone.ip_cluster_count, 1);
    assert.equal(lone.network_label, 'bbbbbb');
  });

  it('treats a null IP hash (legacy/anonymous) as a lone vote', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-legacy', null, null);

    const [v] = voting.getVotesForMeeting(meeting.id);
    assert.equal(v.ip_cluster_count, 1);
    assert.equal(v.network_label, null);
  });
});

describe('calculateResults', () => {
  beforeEach(() => {
    freshDb();
    voting = require('../services/voting');
  });

  it('ranks nominees by total points', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const bookA = seedBook({ title: 'Book A', author: 'Author A' });
    const bookB = seedBook({ title: 'Book B', author: 'Author B' });
    const bookC = seedBook({ title: 'Book C', author: 'Author C' });
    seedNominee(meeting.id, bookA.id);
    seedNominee(meeting.id, bookB.id);
    seedNominee(meeting.id, bookC.id);

    // 3 nominees → N=3: rank 0=3pts, rank 1=2pts, rank 2=1pt
    seedVote(meeting.id, [bookA.id, bookB.id, bookC.id], 'fp-1'); // A=3, B=2, C=1
    seedVote(meeting.id, [bookA.id, bookC.id, bookB.id], 'fp-2'); // A=3, C=2, B=1
    seedVote(meeting.id, [bookB.id, bookA.id, bookC.id], 'fp-3'); // B=3, A=2, C=1

    const results = voting.calculateResults(meeting.id);

    assert.equal(results.voteCount, 3);
    assert.equal(results.rankings.length, 3);
    // A: 3+3+2=8, B: 2+1+3=6, C: 1+2+1=4
    assert.equal(results.rankings[0].title, 'Book A');
    assert.equal(results.rankings[0].points, 8);
    assert.equal(results.rankings[0].rank, 1);
    assert.equal(results.rankings[0].pct, 100);

    assert.equal(results.rankings[1].title, 'Book B');
    assert.equal(results.rankings[1].points, 6);
    assert.equal(results.rankings[1].rank, 2);

    assert.equal(results.rankings[2].title, 'Book C');
    assert.equal(results.rankings[2].points, 4);
    assert.equal(results.rankings[2].rank, 3);
  });

  it('handles zero votes', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);

    const results = voting.calculateResults(meeting.id);
    assert.equal(results.voteCount, 0);
    assert.equal(results.rankings.length, 1);
    assert.equal(results.rankings[0].points, 0);
  });

  it('handles single nominee with votes', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const book = seedBook({ title: 'Solo Book', author: 'Solo Author' });
    seedNominee(meeting.id, book.id);
    seedVote(meeting.id, [book.id], 'fp-1');

    const results = voting.calculateResults(meeting.id);
    assert.equal(results.voteCount, 1);
    assert.equal(results.rankings[0].points, 1); // N=1, rank 0 = 1 pt
    assert.equal(results.rankings[0].pct, 100);
  });

  it('ignores stale book IDs in votes that are no longer nominees', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const bookA = seedBook({ title: 'Book A', author: 'Author A' });
    const bookB = seedBook({ title: 'Book B', author: 'Author B' });
    seedNominee(meeting.id, bookA.id);
    seedNominee(meeting.id, bookB.id);

    // Vote includes a book ID (999) that's not a nominee
    seedVote(meeting.id, [999, bookA.id, bookB.id], 'fp-1');

    const results = voting.calculateResults(meeting.id);
    // bookA and bookB should still get points; 999 is silently skipped
    assert.equal(results.voteCount, 1);
    const aResult = results.rankings.find(r => r.book_id === bookA.id);
    const bResult = results.rankings.find(r => r.book_id === bookB.id);
    assert.ok(aResult);
    assert.ok(bResult);
  });

  it('handles a tie (both get same points)', () => {
    const meeting = seedMeeting({ status: 'voting' });
    const bookA = seedBook({ title: 'Book A', author: 'Author A' });
    const bookB = seedBook({ title: 'Book B', author: 'Author B' });
    seedNominee(meeting.id, bookA.id);
    seedNominee(meeting.id, bookB.id);

    // Two voters, opposite rankings → each gets 3 points total
    seedVote(meeting.id, [bookA.id, bookB.id], 'fp-1'); // A=2, B=1
    seedVote(meeting.id, [bookB.id, bookA.id], 'fp-2'); // B=2, A=1

    const results = voting.calculateResults(meeting.id);
    assert.equal(results.rankings[0].points, 3);
    assert.equal(results.rankings[1].points, 3);
  });
});
