'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedReview } = require('./setup');

let activity, reactions, replies;

describe('activity service', () => {
  let alice, bob, book, meeting;

  beforeEach(() => {
    freshDb();
    activity = require('../services/activity');
    reactions = require('../services/reactions');
    replies = require('../services/replies');
    alice = seedUser({ email: 'alice@test.com', display_name: 'Alice' });
    bob = seedUser({ email: 'bob@test.com', display_name: 'Bob' });
    book = seedBook({ title: 'Children of Time', author: 'Adrian Tchaikovsky' });
    meeting = seedMeeting({ month_year: '2026-03', status: 'nominations' });
  });

  it('returns empty array on a fresh database', () => {
    assert.deepEqual(activity.getRecentActivity(15), []);
  });

  it('includes a review with grade and book info', () => {
    seedReview(book.id, alice.id, { grade: 'A+', body: 'Brilliant' });

    const feed = activity.getRecentActivity(15);
    assert.equal(feed.length, 1);
    const item = feed[0];
    assert.equal(item.type, 'review');
    assert.equal(item.actor_name, 'Alice');
    assert.equal(item.book_title, 'Children of Time');
    assert.equal(item.grade, 'A+');
  });

  it('includes a reply with target name', () => {
    const review = seedReview(book.id, alice.id, { grade: 'A' });
    replies.create(review.id, bob.id, 'Totally agree');

    const feed = activity.getRecentActivity(15);
    const reply = feed.find(i => i.type === 'reply');
    assert.ok(reply);
    assert.equal(reply.actor_name, 'Bob');
    assert.equal(reply.target_name, 'Alice'); // review author
    assert.equal(reply.book_title, 'Children of Time');
  });

  it('includes a reaction with emoji and target name', () => {
    const review = seedReview(book.id, alice.id, { grade: 'A' });
    reactions.toggleReaction(review.id, bob.id, '🔥');

    const feed = activity.getRecentActivity(15);
    const reaction = feed.find(i => i.type === 'reaction');
    assert.ok(reaction);
    assert.equal(reaction.actor_name, 'Bob');
    assert.equal(reaction.target_name, 'Alice');
    assert.equal(reaction.emoji, '🔥');
  });

  it('includes a nomination with meeting month_year', () => {
    db.prepare(`
      INSERT INTO nominations (meeting_id, book_id, user_id, submitted_fingerprint, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(meeting.id, book.id, alice.id, 'fp-1');

    const feed = activity.getRecentActivity(15);
    const nom = feed.find(i => i.type === 'nomination');
    assert.ok(nom);
    assert.equal(nom.actor_name, 'Alice');
    assert.equal(nom.meeting_month_year, '2026-03');
  });

  it('excludes anonymous nominations (null user_id)', () => {
    db.prepare(`
      INSERT INTO nominations (meeting_id, book_id, user_id, submitted_fingerprint, created_at)
      VALUES (?, ?, NULL, ?, datetime('now'))
    `).run(meeting.id, book.id, 'fp-anon');

    const feed = activity.getRecentActivity(15);
    assert.equal(feed.filter(i => i.type === 'nomination').length, 0);
  });

  it('combines all activity types and respects the limit', () => {
    const review = seedReview(book.id, alice.id, { grade: 'A' });
    replies.create(review.id, bob.id, 'Reply');
    reactions.toggleReaction(review.id, bob.id, '👍');
    db.prepare(`
      INSERT INTO nominations (meeting_id, book_id, user_id, submitted_fingerprint, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(meeting.id, book.id, alice.id, 'fp-2');

    // 4 activity items exist; limit to 2
    const limited = activity.getRecentActivity(2);
    assert.equal(limited.length, 2);

    const all = activity.getRecentActivity(15);
    assert.equal(all.length, 4);
    const types = new Set(all.map(i => i.type));
    assert.deepEqual([...types].sort(), ['nomination', 'reaction', 'reply', 'review']);
  });

  it('defaults to a limit of 15 when none provided', () => {
    // Create 20 reviews across 20 books
    for (let i = 0; i < 20; i++) {
      const b = seedBook({ title: `Book ${i}`, author: `Author ${i}` });
      seedReview(b.id, alice.id, { grade: 'B' });
    }
    const feed = activity.getRecentActivity();
    assert.equal(feed.length, 15);
  });
});
