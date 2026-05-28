'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, seedUser, seedBook, seedReview } = require('./setup');

let replies;

describe('replies service', () => {
  let author, replier, book, review;

  beforeEach(() => {
    freshDb();
    replies = require('../services/replies');
    author = seedUser({ email: 'author@test.com', display_name: 'Author' });
    replier = seedUser({ email: 'replier@test.com', display_name: 'Replier' });
    book = seedBook({ title: 'Discussed Book', author: 'Some Author' });
    review = seedReview(book.id, author.id, { grade: 'A', body: 'Loved it' });
  });

  describe('create / getById', () => {
    it('creates a reply and returns its id', () => {
      const id = replies.create(review.id, replier.id, 'I agree!');
      assert.ok(id);

      const row = replies.getById(Number(id));
      assert.equal(row.review_id, review.id);
      assert.equal(row.user_id, replier.id);
      assert.equal(row.body_markdown, 'I agree!');
    });

    it('getById returns null for nonexistent reply', () => {
      assert.equal(replies.getById(99999), null);
    });
  });

  describe('update', () => {
    it('updates the reply body', () => {
      const id = replies.create(review.id, replier.id, 'Original');
      replies.update(Number(id), 'Edited');
      assert.equal(replies.getById(Number(id)).body_markdown, 'Edited');
    });
  });

  describe('remove', () => {
    it('deletes a reply', () => {
      const id = replies.create(review.id, replier.id, 'Delete me');
      replies.remove(Number(id));
      assert.equal(replies.getById(Number(id)), null);
    });
  });

  describe('getRepliesBatch', () => {
    it('returns empty map for empty input', () => {
      assert.equal(replies.getRepliesBatch([]).size, 0);
    });

    it('groups replies by review id with user info', () => {
      replies.create(review.id, replier.id, 'First');
      replies.create(review.id, author.id, 'Second');

      const map = replies.getRepliesBatch([review.id]);
      const list = map.get(review.id);
      assert.equal(list.length, 2);
      // ordered by created_at ASC
      assert.equal(list[0].body_markdown, 'First');
      assert.equal(list[1].body_markdown, 'Second');
      // includes joined user info
      assert.ok(list[0].display_name);
      assert.ok('avatar_style' in list[0]);
    });

    it('separates replies across multiple reviews', () => {
      const review2 = seedReview(book.id, replier.id, { grade: 'B' });
      replies.create(review.id, replier.id, 'On review 1');
      replies.create(review2.id, author.id, 'On review 2');

      const map = replies.getRepliesBatch([review.id, review2.id]);
      assert.equal(map.get(review.id).length, 1);
      assert.equal(map.get(review2.id).length, 1);
    });

    it('omits reviews with no replies from the map', () => {
      const map = replies.getRepliesBatch([review.id]);
      assert.equal(map.has(review.id), false);
    });
  });

  describe('getReplyCountsBatch', () => {
    it('returns empty map for empty input', () => {
      assert.equal(replies.getReplyCountsBatch([]).size, 0);
    });

    it('counts replies per review', () => {
      replies.create(review.id, replier.id, 'One');
      replies.create(review.id, author.id, 'Two');

      const counts = replies.getReplyCountsBatch([review.id]);
      assert.equal(counts.get(review.id), 2);
    });

    it('omits reviews with zero replies', () => {
      const counts = replies.getReplyCountsBatch([review.id]);
      assert.equal(counts.has(review.id), false);
    });
  });
});
