'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, seedUser, seedBook } = require('./setup');

let reactions;
let reviews;

describe('reactions service', () => {
  let user1, user2, book, reviewId;

  beforeEach(() => {
    freshDb();
    reactions = require('../services/reactions');
    reviews = require('../services/reviews');

    user1 = seedUser({ email: 'alice@test.com', display_name: 'Alice' });
    user2 = seedUser({ email: 'bob@test.com', display_name: 'Bob' });
    book = seedBook({ title: 'React Book', author: 'Author' });
    const info = reviews.create(book.id, user1.id, 'A', 'Great!', false, true);
    reviewId = info.lastInsertRowid;
  });

  describe('toggleReaction', () => {
    it('adds a reaction', () => {
      const result = reactions.toggleReaction(reviewId, user2.id, '🔥');
      assert.equal(result.added, true);
      assert.equal(result.count, 1);
    });

    it('removes a reaction on second toggle', () => {
      reactions.toggleReaction(reviewId, user2.id, '🔥');
      const result = reactions.toggleReaction(reviewId, user2.id, '🔥');
      assert.equal(result.added, false);
      assert.equal(result.count, 0);
    });

    it('tracks different emojis independently', () => {
      reactions.toggleReaction(reviewId, user2.id, '🔥');
      reactions.toggleReaction(reviewId, user2.id, '💯');

      const counts = reactions.getReactionCountsBatch([reviewId]);
      const reviewReactions = counts.get(reviewId);
      assert.ok(reviewReactions);
      assert.equal(reviewReactions.length, 2);
    });

    it('tracks different users independently', () => {
      reactions.toggleReaction(reviewId, user1.id, '🔥');
      reactions.toggleReaction(reviewId, user2.id, '🔥');

      const result = reactions.toggleReaction(reviewId, user1.id, '🔥'); // toggle off for user1
      assert.equal(result.added, false);
      assert.equal(result.count, 1); // user2's reaction remains
    });
  });

  describe('getReactionCountsBatch', () => {
    it('returns empty map for no review IDs', () => {
      const counts = reactions.getReactionCountsBatch([]);
      assert.equal(counts.size, 0);
    });

    it('returns aggregated counts', () => {
      reactions.toggleReaction(reviewId, user1.id, '🔥');
      reactions.toggleReaction(reviewId, user2.id, '🔥');

      const counts = reactions.getReactionCountsBatch([reviewId]);
      const fireReaction = counts.get(reviewId).find(r => r.emoji === '🔥');
      assert.equal(fireReaction.count, 2);
    });
  });

  describe('getUserReactionsBatch', () => {
    it('returns which emojis a user reacted with', () => {
      reactions.toggleReaction(reviewId, user1.id, '🔥');
      reactions.toggleReaction(reviewId, user1.id, '💯');

      const userReactions = reactions.getUserReactionsBatch([reviewId], user1.id);
      const emojis = userReactions.get(reviewId);
      assert.ok(emojis);
      assert.ok(emojis.has('🔥'));
      assert.ok(emojis.has('💯'));
    });

    it('returns empty map for no review IDs', () => {
      assert.equal(reactions.getUserReactionsBatch([], user1.id).size, 0);
    });

    it('returns empty map for null userId', () => {
      assert.equal(reactions.getUserReactionsBatch([reviewId], null).size, 0);
    });
  });

  describe('getReactorsForEmoji', () => {
    it('returns the list of users who reacted', () => {
      reactions.toggleReaction(reviewId, user1.id, '🔥');
      reactions.toggleReaction(reviewId, user2.id, '🔥');

      const reactors = reactions.getReactorsForEmoji(reviewId, '🔥');
      assert.equal(reactors.length, 2);
      const names = reactors.map(r => r.display_name);
      assert.ok(names.includes('Alice'));
      assert.ok(names.includes('Bob'));
    });
  });
});
