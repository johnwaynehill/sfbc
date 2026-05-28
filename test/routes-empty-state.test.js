'use strict';

/**
 * Empty-state rendering tests.
 *
 * These catch the "works on my machine" class of bug: an EJS template that
 * references a variable which is undefined/null/empty in a fresh-database or
 * mid-lifecycle state. Each test renders a page in its empty/edge state and
 * asserts it returns a non-error status (200/302) rather than a 500.
 *
 * A 500 here means a template crashed on missing data.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');
const { reloadApp, loginAs } = require('./app-helper');

let app;

/** Assert the response did not 500 (template crash). */
function assertNoServerError(res, label) {
  assert.notEqual(res.status, 500, `${label} returned 500 — likely a template crash. Body: ${String(res.text).slice(0, 300)}`);
  assert.ok(res.status < 500, `${label} returned ${res.status}`);
}

describe('empty-state — public pages on a fresh database', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET / renders with no picks, no meetings, no members', async () => {
    const res = await supertest(app).get('/');
    assertNoServerError(res, 'GET /');
    assert.equal(res.status, 200);
  });

  it('GET /history renders with no completed books', async () => {
    const res = await supertest(app).get('/history');
    assertNoServerError(res, 'GET /history');
    assert.equal(res.status, 200);
  });

  it('GET /about renders with zero stats', async () => {
    const res = await supertest(app).get('/about');
    assertNoServerError(res, 'GET /about');
    assert.equal(res.status, 200);
  });

  it('GET /changelog renders', async () => {
    const res = await supertest(app).get('/changelog');
    assertNoServerError(res, 'GET /changelog');
    assert.equal(res.status, 200);
  });

  it('GET /login renders', async () => {
    const res = await supertest(app).get('/login');
    assertNoServerError(res, 'GET /login');
    assert.equal(res.status, 200);
  });
});

describe('empty-state — home page with partial data', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('renders with an active nominations meeting but no nominees yet', async () => {
    seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const res = await supertest(app).get('/');
    assertNoServerError(res, 'GET / (nominations, no nominees)');
    assert.equal(res.status, 200);
  });

  it('renders with a reading pick that has no events scheduled', async () => {
    const book = seedBook({ title: 'Solo Reading', author: 'Author' });
    const picksService = require('../services/monthly-picks');
    picksService.create(book.id, '2026-06', 'reading');

    const res = await supertest(app).get('/');
    assertNoServerError(res, 'GET / (reading pick, no event)');
    assert.equal(res.status, 200);
  });

  it('renders with an upcoming meeting that has no winning book', async () => {
    seedMeeting({ month_year: '2026-08', status: 'upcoming' });
    const res = await supertest(app).get('/');
    assertNoServerError(res, 'GET / (upcoming, no winner)');
    assert.equal(res.status, 200);
  });
});

describe('empty-state — nominate page edge cases', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('renders nominate page with zero nominees', async () => {
    seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const res = await supertest(app)
      .get('/nominate/july-2026')
      .set('Cookie', '_client_id=fresh-visitor');
    assertNoServerError(res, 'GET /nominate/:slug (no nominees)');
    assert.equal(res.status, 200);
  });

  it('renders live nominations page with zero nominees', async () => {
    seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const res = await supertest(app)
      .get('/nominations/july-2026')
      .set('Cookie', '_client_id=fresh-visitor');
    assertNoServerError(res, 'GET /nominations/:slug (no nominees)');
    assert.equal(res.status, 200);
  });

  it('renders live nominations page with a single nominee (no nominator)', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const book = seedBook({ title: 'Lonely Book', author: 'Author' });
    // Nominee with no associated nomination row (admin-added, no nominator/reason)
    seedNominee(meeting.id, book.id);

    const res = await supertest(app)
      .get('/nominations/july-2026')
      .set('Cookie', '_client_id=fresh-visitor');
    assertNoServerError(res, 'GET /nominations/:slug (single nominee, no nominator)');
    assert.equal(res.status, 200);
  });
});

describe('empty-state — vote ballot edge cases', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('renders ballot with a single nominee', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book = seedBook({ title: 'Only Choice', author: 'Author' });
    seedNominee(meeting.id, book.id);

    const res = await supertest(app)
      .get('/vote/july-2026')
      .set('Cookie', '_client_id=fresh-voter');
    assertNoServerError(res, 'GET /vote/:slug (single nominee)');
    assert.equal(res.status, 200);
  });

  it('renders ballot when voting is open but there are zero nominees', async () => {
    seedMeeting({ month_year: '2026-07', status: 'voting' });
    const res = await supertest(app)
      .get('/vote/july-2026')
      .set('Cookie', '_client_id=fresh-voter');
    assertNoServerError(res, 'GET /vote/:slug (no nominees)');
    // Either renders an empty ballot (200) or redirects — just not a 500
    assert.ok(res.status === 200 || res.status === 302);
  });
});

describe('empty-state — results page edge cases', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('renders live results during voting with zero votes cast', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book1 = seedBook({ title: 'Book A', author: 'Author A' });
    const book2 = seedBook({ title: 'Book B', author: 'Author B' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    const res = await supertest(app).get('/results/july-2026');
    assertNoServerError(res, 'GET /results/:slug (voting, zero votes)');
    assert.equal(res.status, 200);
  });

  it('renders results for a finished meeting with no cached results JSON', async () => {
    // status=results but vote_results_json is null → falls back to live calc
    const meeting = seedMeeting({ month_year: '2026-07', status: 'results' });
    const book = seedBook({ title: 'Winner', author: 'Author' });
    seedNominee(meeting.id, book.id);

    const res = await supertest(app).get('/results/july-2026');
    assertNoServerError(res, 'GET /results/:slug (results, no cached JSON)');
    assert.equal(res.status, 200);
  });

  it('renders results during voting with no nominees at all', async () => {
    seedMeeting({ month_year: '2026-07', status: 'voting' });
    const res = await supertest(app).get('/results/july-2026');
    assertNoServerError(res, 'GET /results/:slug (voting, no nominees)');
    assert.equal(res.status, 200);
  });
});

describe('empty-state — book detail page', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('renders a book that has no reviews and is not a pick', async () => {
    seedBook({ title: 'Orphan Book', author: 'Some Author' });
    const res = await supertest(app).get('/books/some-author/orphan-book');
    assertNoServerError(res, 'GET /books/:author/:title (no reviews, no pick)');
    assert.equal(res.status, 200);
  });

  it('returns 404 for a nonexistent book (not a 500)', async () => {
    const res = await supertest(app).get('/books/nobody/nothing');
    assertNoServerError(res, 'GET /books/:author/:title (nonexistent)');
    assert.equal(res.status, 404);
  });
});

describe('empty-state — authenticated member pages', () => {
  let member;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    member = seedUser({ email: 'member@test.com', display_name: 'Member', role: 'member' });
  });

  it('renders /profile for a user with no reviews and no socials', async () => {
    const agent = supertest.agent(app);
    await loginAs(agent, member);
    const res = await agent.get('/profile');
    assertNoServerError(res, 'GET /profile (no reviews)');
    assert.equal(res.status, 200);
  });

  it('renders /members directory with a single member (no reviews)', async () => {
    const agent = supertest.agent(app);
    await loginAs(agent, member);
    const res = await agent.get('/members');
    assertNoServerError(res, 'GET /members (one member, no reviews)');
    assert.equal(res.status, 200);
  });

  it('renders a public member profile with zero reviews (null avg grade)', async () => {
    const agent = supertest.agent(app);
    await loginAs(agent, member);
    const res = await agent.get(`/members/${member.user_slug}`);
    assertNoServerError(res, 'GET /members/:slug (no reviews, null avg)');
    assert.equal(res.status, 200);
  });
});

describe('empty-state — admin pages on a fresh database', () => {
  let admin;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    admin = seedUser({ email: 'admin@test.com', display_name: 'Admin', role: 'admin' });
  });

  it('renders /admin dashboard with no meetings', async () => {
    const agent = supertest.agent(app);
    await loginAs(agent, admin);
    const res = await agent.get('/admin');
    assertNoServerError(res, 'GET /admin (no meetings)');
    assert.equal(res.status, 200);
  });
});
