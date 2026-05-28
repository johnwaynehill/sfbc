'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, seedUser, seedBook } = require('./setup');

let reviews;

describe('reviews service', () => {
  let user, book;

  beforeEach(() => {
    freshDb();
    reviews = require('../services/reviews');
    user = seedUser({ email: 'reviewer@test.com', display_name: 'Reviewer' });
    book = seedBook({ title: 'Test Book', author: 'Test Author' });
  });

  it('getAllGrades returns the grade scale', () => {
    const grades = reviews.getAllGrades();
    assert.ok(grades.length >= 14, `Expected at least 14 grades, got ${grades.length}`);
    const gradeLabels = grades.map(g => g.grade);
    assert.ok(gradeLabels.includes('S'), 'Should include S grade');
    assert.ok(gradeLabels.includes('A'), 'Should include A grade');
    assert.ok(gradeLabels.includes('F'), 'Should include F grade');
    // Weights should be descending
    for (let i = 1; i < grades.length; i++) {
      assert.ok(grades[i - 1].weight >= grades[i].weight,
        `Grades not descending: ${grades[i - 1].grade}(${grades[i - 1].weight}) < ${grades[i].grade}(${grades[i].weight})`);
    }
  });

  it('creates a review', () => {
    const info = reviews.create(book.id, user.id, 'A', 'Great book!', false, true);
    assert.ok(info.changes >= 1);

    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.ok(review);
    assert.equal(review.grade, 'A');
    assert.equal(review.body_markdown, 'Great book!');
    assert.equal(review.did_finish, 1);
    assert.equal(review.has_spoilers, 0);
  });

  it('creates a review with null body', () => {
    reviews.create(book.id, user.id, 'B', null, false, true);
    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.equal(review.body_markdown, null);
  });

  it('creates a review with spoiler flag', () => {
    reviews.create(book.id, user.id, 'C', 'Spoilers!', true, true);
    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.equal(review.has_spoilers, 1);
  });

  it('creates a review with did_finish = false', () => {
    reviews.create(book.id, user.id, 'D', 'DNF', false, false);
    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.equal(review.did_finish, 0);
  });

  it('updates an existing review', () => {
    reviews.create(book.id, user.id, 'B', 'Okay', false, true);
    reviews.update(book.id, user.id, 'A+', 'Actually great!', false, true);

    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.equal(review.grade, 'A+');
    assert.equal(review.body_markdown, 'Actually great!');
  });

  it('deletes a review', () => {
    reviews.create(book.id, user.id, 'B', 'Will delete', false, true);
    const info = reviews.deleteByBookAndUser(book.id, user.id);
    assert.equal(info.changes, 1);

    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.equal(review, undefined);
  });

  it('getByUser returns all reviews for a user', () => {
    const book2 = seedBook({ title: 'Second Book', author: 'Author 2' });
    reviews.create(book.id, user.id, 'A', 'First review', false, true);
    reviews.create(book2.id, user.id, 'B', 'Second review', false, true);

    const userReviews = reviews.getByUser(user.id);
    assert.equal(userReviews.length, 2);
    assert.ok(userReviews.every(r => r.title), 'Should include book title');
    assert.ok(userReviews.every(r => r.weight != null), 'Should include grade weight');
  });

  it('getByBookAndUser returns undefined for nonexistent review', () => {
    const review = reviews.getByBookAndUser(book.id, user.id);
    assert.equal(review, undefined);
  });

  it('delete returns 0 changes for nonexistent review', () => {
    const info = reviews.deleteByBookAndUser(book.id, user.id);
    assert.equal(info.changes, 0);
  });
});
