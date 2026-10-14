'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');
const redirect = require('../middleware/redirect-to-gatherbound');

const BASE = 'https://gatherbound.club/c/sf-scifi-fantasy';
function app() {
  const a = express();
  a.use(redirect(BASE));
  a.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return a;
}

test('every old page goes to the same page on GatherBound', async () => {
  const cases = {
    '/': BASE,
    '/landing': BASE,
    '/history': `${BASE}/history`,
    '/about/': `${BASE}/about`,
    '/members/megan-hale': `${BASE}/members/megan-hale`,
    '/my-reviews': `${BASE}/my-reviews`,
    '/books/ursula-k-le-guin/the-dispossessed': `${BASE}/books/ursula-k-le-guin/the-dispossessed`,
    '/vote/september-2026': `${BASE}/vote/2026-09`,
    '/nominate/january-2027': `${BASE}/nominate/2027-01`,
    '/results': `${BASE}/results`,
    '/admin/users': `${BASE}/admin`,
    '/picks/september-2026': `${BASE}/history`,
    '/login': 'https://gatherbound.club/sign-in',
    '/auth/callback?token=abc': 'https://gatherbound.club/sign-in',
    '/join/ABC123?ref=meetup': `${BASE}/join/ABC123?ref=meetup`,
    '/img/covers/14.jpg': BASE,
    '/something-else': BASE,
  };
  for (const [from, to] of Object.entries(cases)) {
    const res = await supertest(app()).get(from);
    assert.equal(res.status, 301, from);
    assert.equal(res.headers.location, to, from);
  }
});

test('health stays up, so Fly keeps the machine running', async () => {
  const res = await supertest(app()).get('/health');
  assert.equal(res.status, 200);
});

test('the service worker is replaced by one that removes itself, not redirected', async () => {
  const res = await supertest(app()).get('/sw.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /javascript/);
  assert.match(res.text, /unregister\(\)/);
  assert.match(res.text, /caches\.delete/);
});

test('a form posted to the old app is refused with where to go', async () => {
  const res = await supertest(app()).post('/nominate/september-2026').send('title=Dune');
  assert.equal(res.status, 410);
  assert.match(res.text, /gatherbound\.club/);
});

test('month slugs convert; anything else passes through', () => {
  assert.equal(redirect.newMonth('december-2026'), '2026-12');
  assert.equal(redirect.newMonth('2026-12'), '2026-12');
  assert.equal(redirect.newMonth('not-a-month'), 'not-a-month');
});
