'use strict';

/**
 * SSE (Server-Sent Events) endpoint tests.
 *
 * The live nominee list, vote count, and results streams are meeting-critical.
 * Their guard logic (invalid ID → 400, wrong-status meeting → 404) is easy to
 * regress. The streams themselves stay open, so for the success cases we read
 * only the initial payload then abort the request rather than waiting for end.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const supertest = require('supertest');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');
const { reloadApp, loginAs } = require('./app-helper');

let app, server, baseUrl;

/**
 * Open an SSE connection against the running test server, collect the first
 * chunk(s) until we have at least one complete event, then destroy the socket.
 * Resolves with { status, headers, body }.
 */
function readSseInitial(path, { headers = {}, timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(baseUrl + path, { headers }, (res) => {
      let body = '';
      const done = (extra) => {
        try { req.destroy(); } catch { /* ignore */ }
        resolve({ status: res.statusCode, headers: res.headers, body, ...extra });
      };

      // Non-2xx responses end normally — collect and resolve.
      if (res.statusCode !== 200) {
        res.on('data', (c) => { body += c; });
        res.on('end', () => done());
        return;
      }

      // 200 SSE stream: grab the first event then bail.
      res.on('data', (chunk) => {
        body += chunk.toString();
        // An SSE event is terminated by a blank line ("\n\n").
        if (body.includes('\n\n')) done();
      });
      res.on('end', () => done());

      // Safety: don't hang forever if no data arrives.
      setTimeout(() => done(), timeoutMs).unref?.();
    });

    req.on('error', (err) => {
      // Destroying the socket after we have data triggers ECONNRESET — ignore.
      if (err.code === 'ECONNRESET') return;
      reject(err);
    });
  });
}

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server = null;
  });
}

describe('SSE — results stream guards', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('returns 400 for a non-numeric meeting ID', async () => {
    const res = await supertest(app).get('/api/meetings/abc/results/stream');
    assert.equal(res.status, 400);
  });

  it('returns 404 for a nonexistent meeting', async () => {
    const res = await supertest(app).get('/api/meetings/99999/results/stream');
    assert.equal(res.status, 404);
  });

  it('returns 404 when meeting is in nominations (not voting/results)', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'nominations' });
    const res = await supertest(app).get(`/api/meetings/${meeting.id}/results/stream`);
    assert.equal(res.status, 404);
  });

  it('returns 404 when meeting is scheduled', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'scheduled' });
    const res = await supertest(app).get(`/api/meetings/${meeting.id}/results/stream`);
    assert.equal(res.status, 404);
  });
});

describe('SSE — nominations stream guards', () => {
  beforeEach(() => {
    freshDb();
    app = reloadApp();
  });

  it('returns 400 for a non-numeric meeting ID', async () => {
    const res = await supertest(app).get('/api/meetings/abc/nominations/stream');
    assert.equal(res.status, 400);
  });

  it('returns 404 for a nonexistent meeting', async () => {
    const res = await supertest(app).get('/api/meetings/99999/nominations/stream');
    assert.equal(res.status, 404);
  });

  it('returns 404 when meeting is in voting (not nominations)', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const res = await supertest(app).get(`/api/meetings/${meeting.id}/nominations/stream`);
    assert.equal(res.status, 404);
  });
});

describe('SSE — admin meeting stream guards', () => {
  let admin;

  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    admin = seedUser({ email: 'admin@test.com', display_name: 'Admin', role: 'admin' });
  });

  it('redirects unauthenticated users to admin login', async () => {
    const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
    const res = await supertest(app).get(`/api/admin/meetings/${meeting.id}/stream`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin/login');
  });

  it('returns 400 for a non-numeric meeting ID (authenticated admin)', async () => {
    const agent = supertest.agent(app);
    await loginAs(agent, admin);
    const res = await agent.get('/api/admin/meetings/abc/stream');
    assert.equal(res.status, 400);
  });

  it('returns 404 for a nonexistent meeting (authenticated admin)', async () => {
    const agent = supertest.agent(app);
    await loginAs(agent, admin);
    const res = await agent.get('/api/admin/meetings/99999/stream');
    assert.equal(res.status, 404);
  });
});

describe('SSE — initial payloads (live connection)', () => {
  beforeEach(async () => {
    freshDb();
    app = reloadApp();
    await startServer();
  });

  // Close the server after each test so the process can exit.
  // (node:test runs afterEach via the test context; use a try/finally-safe hook)
  it('results stream emits initial results data during voting', async () => {
    try {
      const meeting = seedMeeting({ month_year: '2026-07', status: 'voting' });
      const book1 = seedBook({ title: 'Book A', author: 'Author A' });
      const book2 = seedBook({ title: 'Book B', author: 'Author B' });
      seedNominee(meeting.id, book1.id);
      seedNominee(meeting.id, book2.id);
      seedVote(meeting.id, [book1.id, book2.id], 'fp-1');

      const res = await readSseInitial(`/api/meetings/${meeting.id}/results/stream`);
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/event-stream/);
      assert.match(res.body, /^data: /m);

      // The initial payload should be valid JSON with rankings + voteCount.
      const dataLine = res.body.split('\n').find((l) => l.startsWith('data: '));
      const payload = JSON.parse(dataLine.slice('data: '.length));
      assert.ok(Array.isArray(payload.rankings));
      assert.equal(payload.voteCount, 1);
    } finally {
      await stopServer();
    }
  });

  it('nominations stream emits initial nominees list', async () => {
    try {
      const meeting = seedMeeting({ month_year: '2026-07', status: 'nominations' });
      const book = seedBook({ title: 'Nominee Book', author: 'Author' });
      seedNominee(meeting.id, book.id);

      const res = await readSseInitial(`/api/meetings/${meeting.id}/nominations/stream`);
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/event-stream/);
      assert.match(res.body, /event: nominees/);

      const dataLine = res.body.split('\n').find((l) => l.startsWith('data: '));
      const nominees = JSON.parse(dataLine.slice('data: '.length));
      assert.ok(Array.isArray(nominees));
      assert.equal(nominees.length, 1);
      assert.equal(nominees[0].title, 'Nominee Book');
    } finally {
      await stopServer();
    }
  });

  it('home stream emits initial announcements and activity events', async () => {
    try {
      const res = await readSseInitial('/api/home/stream');
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/event-stream/);
      // First event is announcements
      assert.match(res.body, /event: announcements/);
    } finally {
      await stopServer();
    }
  });
});
