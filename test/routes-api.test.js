'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');
const { reloadApp, loginAs } = require('./app-helper');

let app, request;

describe('API routes — nominations', () => {
  let meeting, admin;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    request = supertest.agent(app);

    admin = seedUser({ email: 'admin@test.com', display_name: 'Admin', role: 'admin' });
    meeting = seedMeeting({ month_year: '2026-07', status: 'nominations' });
    await loginAs(request, admin);
  });

  it('POST /api/meetings/:id/nominations submits a nomination', async () => {
    const res = await request
      .post(`/api/meetings/${meeting.id}/nominations`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-client-1')
      .send({ title: 'Dune', author: 'Frank Herbert' })
      .expect(201);

    assert.ok(res.body.success);
    assert.equal(res.body.book.title, 'Dune');
    assert.equal(res.body.book.author, 'Frank Herbert');
  });

  it('rejects nomination when meeting is not in nominations status', async () => {
    // Change meeting to voting
    db.prepare("UPDATE meetings SET status = 'voting' WHERE id = ?").run(meeting.id);

    const res = await request
      .post(`/api/meetings/${meeting.id}/nominations`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-client-1')
      .send({ title: 'Dune', author: 'Frank Herbert' })
      .expect(403);

    assert.ok(res.body.error);
    assert.match(res.body.error, /not open/i);
  });

  it('rejects nomination for nonexistent meeting', async () => {
    const res = await request
      .post('/api/meetings/99999/nominations')
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-client-1')
      .send({ title: 'Dune', author: 'Frank Herbert' })
      .expect(404);

    assert.ok(res.body.error);
  });

  it('rejects nomination with missing title', async () => {
    const res = await request
      .post(`/api/meetings/${meeting.id}/nominations`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-client-1')
      .send({ author: 'Frank Herbert' })
      .expect(400);

    assert.ok(res.body.error);
  });

  it('allows re-nomination (replaces previous nomination for same fingerprint)', async () => {
    // First nomination
    await request
      .post(`/api/meetings/${meeting.id}/nominations`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-client-1')
      .send({ title: 'Dune', author: 'Frank Herbert' })
      .expect(201);

    // Re-nominate with different book
    const res = await request
      .post(`/api/meetings/${meeting.id}/nominations`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-client-1')
      .send({ title: 'Neuromancer', author: 'William Gibson' })
      .expect(201);

    assert.equal(res.body.book.title, 'Neuromancer');

    // Should only have 1 nominee (the replacement)
    const nominees = db.prepare('SELECT * FROM meeting_nominees WHERE meeting_id = ?').all(meeting.id);
    assert.equal(nominees.length, 1);
  });
});

describe('API routes — voting', () => {
  let meeting, book1, book2, book3;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    request = supertest.agent(app);

    meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    book1 = seedBook({ title: 'Book A', author: 'Author A' });
    book2 = seedBook({ title: 'Book B', author: 'Author B' });
    book3 = seedBook({ title: 'Book C', author: 'Author C' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);
    seedNominee(meeting.id, book3.id);
  });

  it('POST /api/meetings/:id/votes submits a vote (JSON array)', async () => {
    const res = await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-voter-1')
      .send({ ranking: [book1.id, book2.id, book3.id] })
      .expect(201);

    assert.ok(res.body.success);
    assert.ok(res.body.redirect);
  });

  it('rejects duplicate vote from same fingerprint', async () => {
    // First vote
    await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-voter-1')
      .send({ ranking: [book1.id, book2.id, book3.id] })
      .expect(201);

    // Duplicate vote (same _client_id)
    const res = await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-voter-1')
      .send({ ranking: [book2.id, book1.id, book3.id] })
      .expect(409);

    assert.match(res.body.error, /already voted/i);
  });

  it('rejects vote when meeting is not in voting status', async () => {
    db.prepare("UPDATE meetings SET status = 'nominations' WHERE id = ?").run(meeting.id);

    const res = await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-voter-1')
      .send({ ranking: [book1.id, book2.id, book3.id] })
      .expect(403);

    assert.match(res.body.error, /not open/i);
  });

  it('handles stale ballot (removed nominee) gracefully', async () => {
    // Vote includes a book that has been removed from nominees
    const staleBookId = 99999;
    const res = await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-voter-1')
      .send({ ranking: [staleBookId, book1.id, book2.id, book3.id] })
      .expect(201);

    assert.ok(res.body.success);

    // Verify stored ranking only contains valid nominees
    const vote = db.prepare('SELECT ranking_json FROM votes WHERE meeting_id = ?').get(meeting.id);
    const ranking = JSON.parse(vote.ranking_json);
    assert.ok(!ranking.includes(staleBookId), 'Stale book ID should be stripped');
    assert.equal(ranking.length, 3, 'All 3 valid nominees should be present');
  });

  it('appends missing nominees to partial ballot', async () => {
    // Vote only ranks 1 of 3 books — the other 2 should be appended
    const res = await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=test-voter-1')
      .send({ ranking: [book2.id] })
      .expect(201);

    const vote = db.prepare('SELECT ranking_json FROM votes WHERE meeting_id = ?').get(meeting.id);
    const ranking = JSON.parse(vote.ranking_json);
    assert.equal(ranking.length, 3, 'All 3 nominees should be in the ranking');
    assert.equal(ranking[0], book2.id, 'First choice should be preserved');
  });

  it('allows different users to vote on same meeting', async () => {
    await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=voter-alice')
      .send({ ranking: [book1.id, book2.id, book3.id] })
      .expect(201);

    await request
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=voter-bob')
      .send({ ranking: [book3.id, book2.id, book1.id] })
      .expect(201);

    const voteCount = db.prepare('SELECT COUNT(*) AS cnt FROM votes WHERE meeting_id = ?').get(meeting.id).cnt;
    assert.equal(voteCount, 2);
  });

  it('rejects a second vote from the same logged-in user across browsers', async () => {
    const user = seedUser({ email: 'voter@test.com', display_name: 'Voter' });

    // First browser/session: log in and vote.
    const browser1 = supertest.agent(app);
    await loginAs(browser1, user);
    await browser1
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=browser-one')
      .send({ ranking: [book1.id, book2.id, book3.id] })
      .expect(201);

    // Second browser (e.g. private window): same user logs in again with a
    // fresh _client_id cookie → different fingerprint, but same user_id.
    const browser2 = supertest.agent(app);
    await loginAs(browser2, user);
    const res = await browser2
      .post(`/api/meetings/${meeting.id}/votes`)
      .set('Accept', 'application/json')
      .set('Cookie', '_client_id=browser-two')
      .send({ ranking: [book3.id, book2.id, book1.id] })
      .expect(409);

    assert.match(res.body.error, /already voted/i);

    const voteCount = db.prepare('SELECT COUNT(*) AS cnt FROM votes WHERE meeting_id = ?').get(meeting.id).cnt;
    assert.equal(voteCount, 1, 'Only the first vote should be stored');
  });
});

describe('API routes — admin meeting lifecycle', () => {
  let admin, meeting;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    request = supertest.agent(app);

    admin = seedUser({ email: 'admin@test.com', display_name: 'Admin', role: 'admin' });
    meeting = seedMeeting({ month_year: '2026-07', status: 'scheduled' });
    await loginAs(request, admin);
  });

  it('PUT /api/admin/meetings/:id/status advances lifecycle', async () => {
    // scheduled → nominations
    const res = await request
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'nominations' })
      .expect(200);

    assert.ok(res.body.success);
    assert.equal(res.body.meeting.status, 'nominations');
  });

  it('rejects invalid transition', async () => {
    // scheduled → voting (invalid, must go through nominations)
    const res = await request
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'voting' })
      .expect(400);

    assert.ok(res.body.error);
    assert.match(res.body.error, /cannot transition/i);
  });

  it('full lifecycle via API: scheduled → nominations → voting → upcoming', async () => {
    // scheduled → nominations
    await request
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'nominations' })
      .expect(200);

    // Add nominees via admin endpoint
    const book1 = seedBook({ title: 'Book 1', author: 'Author 1' });
    const book2 = seedBook({ title: 'Book 2', author: 'Author 2' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    // nominations → voting
    await request
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'voting' })
      .expect(200);

    // Add some votes
    seedVote(meeting.id, [book1.id, book2.id], 'fp-1');
    seedVote(meeting.id, [book1.id, book2.id], 'fp-2');

    // voting → upcoming (determines winner)
    const res = await request
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'upcoming' })
      .expect(200);

    assert.equal(res.body.meeting.status, 'upcoming');
    assert.equal(res.body.meeting.winning_book_id, book1.id);
    assert.ok(res.body.meeting.vote_results_json, 'Results JSON should be stored');
  });

  it('rejects lifecycle advance for unauthenticated user', async () => {
    // Create a fresh agent (no session)
    const anonRequest = supertest(app);

    await anonRequest
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'nominations' })
      .expect(302); // redirects to admin login
  });

  it('rejects lifecycle advance for non-admin user', async () => {
    const member = seedUser({ email: 'member@test.com', display_name: 'Member', role: 'member' });
    const memberAgent = supertest.agent(app);
    await loginAs(memberAgent, member);

    await memberAgent
      .put(`/api/admin/meetings/${meeting.id}/status`)
      .send({ status: 'nominations' })
      .expect(302); // redirects to admin login
  });
});

describe('API routes — reviews', () => {
  let member, book;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    request = supertest.agent(app);

    member = seedUser({ email: 'reviewer@test.com', display_name: 'Reviewer', role: 'member' });
    book = seedBook({ title: 'Test Book', author: 'Test Author' });
    await loginAs(request, member);
  });

  it('POST /api/books/:id/reviews creates a review', async () => {
    const res = await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'A', body: 'Great book!' })
      .expect(201);

    assert.ok(res.body.success);

    // Verify in DB
    const review = db.prepare('SELECT * FROM reviews WHERE book_id = ? AND user_id = ?')
      .get(book.id, member.id);
    assert.ok(review);
    assert.equal(review.grade, 'A');
  });

  it('rejects duplicate review for same book', async () => {
    await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'A', body: 'First review' })
      .expect(201);

    const res = await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'B', body: 'Second attempt' })
      .expect(409);

    assert.match(res.body.error, /already have a review/i);
  });

  it('PUT /api/books/:id/reviews updates an existing review', async () => {
    await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'B', body: 'Initial' })
      .expect(201);

    const res = await request
      .put(`/api/books/${book.id}/reviews`)
      .send({ grade: 'A+', body: 'Updated!' })
      .expect(200);

    assert.ok(res.body.success);

    const review = db.prepare('SELECT * FROM reviews WHERE book_id = ? AND user_id = ?')
      .get(book.id, member.id);
    assert.equal(review.grade, 'A+');
  });

  it('DELETE /api/books/:id/reviews deletes a review', async () => {
    await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'C', body: 'Meh' })
      .expect(201);

    await request
      .delete(`/api/books/${book.id}/reviews`)
      .expect(200);

    const review = db.prepare('SELECT * FROM reviews WHERE book_id = ? AND user_id = ?')
      .get(book.id, member.id);
    assert.equal(review, undefined);
  });

  it('rejects review creation for unauthenticated user', async () => {
    const anonRequest = supertest(app);

    await anonRequest
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'A', body: 'Anon review' })
      .expect(302); // redirects to login
  });

  it('rejects invalid grade', async () => {
    const res = await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'Z', body: 'Bad grade' })
      .expect(400);

    assert.match(res.body.error, /invalid grade/i);
  });

  it('handles review with spoiler flag and DNF', async () => {
    const res = await request
      .post(`/api/books/${book.id}/reviews`)
      .send({ grade: 'D', body: 'Did not finish', has_spoilers: true, did_finish: false })
      .expect(201);

    const review = db.prepare('SELECT * FROM reviews WHERE book_id = ? AND user_id = ?')
      .get(book.id, member.id);
    assert.equal(review.has_spoilers, 1);
    assert.equal(review.did_finish, 0);
  });
});

describe('API routes — reactions', () => {
  let member, book, reviewId;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    request = supertest.agent(app);

    member = seedUser({ email: 'reactor@test.com', display_name: 'Reactor', role: 'member' });
    book = seedBook({ title: 'React Book', author: 'Author' });
    await loginAs(request, member);

    // Create a review to react to
    const reviewer = seedUser({ email: 'author@test.com', display_name: 'Author' });
    const info = db.prepare(
      "INSERT INTO reviews (book_id, user_id, grade, body_markdown, has_spoilers, did_finish, created_at, updated_at) VALUES (?, ?, 'A', 'Great!', 0, 1, datetime('now'), datetime('now'))"
    ).run(book.id, reviewer.id);
    reviewId = Number(info.lastInsertRowid);
  });

  it('POST /api/reviews/:id/reactions toggles a reaction', async () => {
    // Add reaction
    const res1 = await request
      .post(`/api/reviews/${reviewId}/reactions`)
      .send({ emoji: '🔥' })
      .expect(200);

    assert.equal(res1.body.added, true);
    assert.equal(res1.body.count, 1);

    // Toggle off
    const res2 = await request
      .post(`/api/reviews/${reviewId}/reactions`)
      .send({ emoji: '🔥' })
      .expect(200);

    assert.equal(res2.body.added, false);
    assert.equal(res2.body.count, 0);
  });

  it('rejects reaction on nonexistent review', async () => {
    await request
      .post('/api/reviews/99999/reactions')
      .send({ emoji: '🔥' })
      .expect(404);
  });

  it('GET /api/reviews/:id/reactions/:emoji returns reactors', async () => {
    // Add a reaction first
    await request
      .post(`/api/reviews/${reviewId}/reactions`)
      .send({ emoji: '🔥' })
      .expect(200);

    const res = await request
      .get(`/api/reviews/${reviewId}/reactions/${encodeURIComponent('🔥')}`)
      .expect(200);

    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].display_name, 'Reactor');
  });
});

describe('API routes — health check', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET /health returns ok', async () => {
    const res = await supertest(app).get('/health').expect(200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api/health returns ok', async () => {
    const res = await supertest(app).get('/api/health').expect(200);
    assert.equal(res.body.status, 'ok');
  });
});
