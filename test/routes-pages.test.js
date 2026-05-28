'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');
const { reloadApp, loginAs } = require('./app-helper');

let app;

describe('page routes — home', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET / returns 200', async () => {
    const res = await supertest(app).get('/').expect(200);
    assert.ok(res.text.includes('</html>'));
  });

  it('GET / shows hero when a pick is reading', async () => {
    const book = seedBook({ title: 'Hero Book', author: 'Great Author' });
    const picksService = require('../services/monthly-picks');
    picksService.create(book.id, '2026-06', 'reading');

    const res = await supertest(app).get('/').expect(200);
    assert.ok(res.text.includes('Hero Book'), 'Page should contain the hero book title');
  });
});

describe('page routes — nominate', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET /nominate redirects to home when no nominations meeting exists', async () => {
    const res = await supertest(app).get('/nominate').expect(302);
    assert.equal(res.headers.location, '/');
  });

  it('GET /nominate redirects to slug when nominations are open', async () => {
    seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const res = await supertest(app).get('/nominate').expect(302);
    assert.equal(res.headers.location, '/nominate/july-2026');
  });

  it('GET /nominate/:slug returns 200 for nominations meeting', async () => {
    seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const res = await supertest(app).get('/nominate/july-2026').expect(200);
    assert.ok(res.text.includes('Nominate'));
  });

  it('GET /nominate/:slug redirects home if meeting is not in nominations status', async () => {
    seedMeeting({ month_year: '2026-07', status: 'voting' });
    const res = await supertest(app).get('/nominate/july-2026').expect(302);
    assert.equal(res.headers.location, '/');
  });
});

describe('page routes — vote', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET /vote redirects to home when no voting meeting exists', async () => {
    const res = await supertest(app).get('/vote').expect(302);
    assert.equal(res.headers.location, '/');
  });

  it('GET /vote redirects to slug when voting is open', async () => {
    seedMeeting({ month_year: '2026-07', status: 'voting' });
    const res = await supertest(app).get('/vote').expect(302);
    assert.equal(res.headers.location, '/vote/july-2026');
  });

  it('GET /vote/:slug returns ballot page for voting meeting', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book = seedBook({ title: 'Ballot Book', author: 'Author' });
    seedNominee(meeting.id, book.id);

    const res = await supertest(app)
      .get('/vote/july-2026')
      .set('Cookie', '_client_id=test-voter')
      .expect(200);

    assert.ok(res.text.includes('Ballot Book'), 'Ballot should show nominee');
  });

  it('GET /vote/:slug redirects to results if already voted', async () => {
    const crypto = require('crypto');
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book = seedBook();
    seedNominee(meeting.id, book.id);

    // Fingerprint is HMAC(sessionSecret, clientId:meetingId)
    const clientId = 'test-voter';
    const fp = crypto
      .createHmac('sha256', 'test-secret')
      .update(`${clientId}:${meeting.id}`)
      .digest('hex');
    seedVote(meeting.id, [book.id], fp);

    const res = await supertest(app)
      .get('/vote/july-2026')
      .set('Cookie', `_client_id=${clientId}`)
      .expect(302);

    assert.equal(res.headers.location, '/results/july-2026');
  });

  it('GET /vote/:slug redirects to results for finished meeting', async () => {
    seedMeeting({ month_year: '2026-07', status: 'results' });

    const res = await supertest(app).get('/vote/july-2026').expect(302);
    assert.equal(res.headers.location, '/results/july-2026');
  });

  it('GET /vote/:slug redirects home for non-voting meeting', async () => {
    seedMeeting({ month_year: '2026-07', status: 'nominations' });

    const res = await supertest(app).get('/vote/july-2026').expect(302);
    assert.equal(res.headers.location, '/');
  });
});

describe('page routes — results', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET /results redirects to home when no meeting exists', async () => {
    const res = await supertest(app).get('/results').expect(302);
    assert.equal(res.headers.location, '/');
  });

  it('GET /results/:slug renders live results during voting', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const book1 = seedBook({ title: 'Book A', author: 'Author A' });
    const book2 = seedBook({ title: 'Book B', author: 'Author B' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);
    seedVote(meeting.id, [book1.id, book2.id], 'fp-1');

    const res = await supertest(app).get('/results/july-2026').expect(200);
    assert.ok(res.text.includes('Live Results') || res.text.includes('Book A'));
  });

  it('GET /results/:slug renders final results for finished meeting', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'results' });
    const book1 = seedBook({ title: 'Winner', author: 'Author W' });
    const book2 = seedBook({ title: 'Runner Up', author: 'Author R' });
    seedNominee(meeting.id, book1.id);
    seedNominee(meeting.id, book2.id);

    // Store results JSON
    const resultsJson = JSON.stringify({
      rankings: [
        { book_id: book1.id, title: 'Winner', author: 'Author W', points: 10, rank: 1, pct: 100 },
        { book_id: book2.id, title: 'Runner Up', author: 'Author R', points: 5, rank: 2, pct: 50 },
      ],
      voteCount: 5,
      maxPoints: 10,
    });
    db.prepare('UPDATE meetings SET vote_results_json = ? WHERE id = ?').run(resultsJson, meeting.id);

    const res = await supertest(app).get('/results/july-2026').expect(200);
    assert.ok(res.text.includes('Final Results') || res.text.includes('Winner'));
  });

  it('GET /results/:slug redirects home for meeting not ready for results', async () => {
    seedMeeting({ month_year: '2026-07', status: 'scheduled' });

    const res = await supertest(app).get('/results/july-2026').expect(302);
    assert.equal(res.headers.location, '/');
  });
});

describe('page routes — auth', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET /login returns login page', async () => {
    const res = await supertest(app).get('/login').expect(200);
    assert.ok(res.text.includes('Sign In') || res.text.includes('login'));
  });

  it('GET /login redirects home if already logged in', async () => {
    const user = seedUser({ email: 'alice@test.com' });
    const agent = supertest.agent(app);
    await loginAs(agent, user);

    const res = await agent.get('/login').expect(302);
    assert.equal(res.headers.location, '/');
  });

  it('POST /auth/password-login creates account for new user', async () => {
    const res = await supertest.agent(app)
      .post('/auth/password-login')
      .send({ email: 'new@test.com', password: 'newpass123' })
      .expect(200);

    assert.ok(res.body.success);

    // Verify user was created
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('new@test.com');
    assert.ok(user);
    assert.equal(user.role, 'member');
  });

  it('POST /auth/password-login rejects wrong password', async () => {
    const user = seedUser({ email: 'alice@test.com' });
    const bcrypt = require('bcryptjs');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync('correctpass', 4), user.id);

    const res = await supertest(app)
      .post('/auth/password-login')
      .send({ email: 'alice@test.com', password: 'wrongpass1' })
      .expect(401);

    assert.match(res.body.error, /invalid/i);
  });

  it('GET /auth/logout destroys session and redirects', async () => {
    const user = seedUser({ email: 'alice@test.com' });
    const agent = supertest.agent(app);
    await loginAs(agent, user);

    const res = await agent.get('/auth/logout').expect(302);
    assert.equal(res.headers.location, '/');
  });
});

describe('page routes — 404', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await supertest(app).get('/nonexistent-page').expect(404);
    assert.ok(res.text.includes('404') || res.text.includes('Not Found'));
  });
});

describe('page routes — admin auth guard', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('GET /admin redirects to admin login when not authenticated', async () => {
    const res = await supertest(app).get('/admin').expect(302);
    assert.equal(res.headers.location, '/admin/login');
  });

  it('GET /admin redirects to admin login for non-admin user', async () => {
    const member = seedUser({ email: 'member@test.com', role: 'member' });
    const agent = supertest.agent(app);
    await loginAs(agent, member);

    const res = await agent.get('/admin').expect(302);
    assert.equal(res.headers.location, '/admin/login');
  });

  it('GET /admin returns 200 for admin user', async () => {
    const admin = seedUser({ email: 'admin@test.com', role: 'admin' });
    const agent = supertest.agent(app);
    await loginAs(agent, admin);

    await agent.get('/admin').expect(200);
  });
});
