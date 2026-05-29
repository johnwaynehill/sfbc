'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const { db, freshDb } = require('./setup');
const { reloadApp } = require('./app-helper');

describe('waitlist service', () => {
  let waitlist;

  beforeEach(() => {
    freshDb();
    waitlist = require('../services/waitlist');
  });

  it('records a signup and counts it', () => {
    const res = waitlist.addSignup({ name: 'Ada', email: 'ada@test.com', clubName: 'Bay SF', cityState: 'SF, CA' });
    assert.equal(res.created, true);
    assert.equal(waitlist.countSignups(), 1);

    const row = db.prepare('SELECT * FROM waitlist_signups WHERE email = ?').get('ada@test.com');
    assert.equal(row.name, 'Ada');
    assert.equal(row.club_name, 'Bay SF');
    assert.equal(row.city_state, 'SF, CA');
  });

  it('stores null for omitted optional fields', () => {
    waitlist.addSignup({ name: 'Grace', email: 'grace@test.com' });
    const row = db.prepare('SELECT * FROM waitlist_signups WHERE email = ?').get('grace@test.com');
    assert.equal(row.club_name, null);
    assert.equal(row.city_state, null);
  });

  it('is idempotent on a duplicate email', () => {
    assert.equal(waitlist.addSignup({ name: 'Ada', email: 'dup@test.com' }).created, true);
    assert.equal(waitlist.addSignup({ name: 'Ada Again', email: 'dup@test.com' }).created, false);
    assert.equal(waitlist.countSignups(), 1);
  });

  it('returns recent signups newest-first', () => {
    db.prepare("INSERT INTO waitlist_signups (name, email, created_at) VALUES ('Old', 'old@test.com', '2020-01-01 00:00:00')").run();
    db.prepare("INSERT INTO waitlist_signups (name, email, created_at) VALUES ('New', 'new@test.com', '2026-01-01 00:00:00')").run();
    const recent = waitlist.getRecent(10);
    assert.equal(recent[0].email, 'new@test.com');
    assert.equal(recent[1].email, 'old@test.com');
  });
});

describe('POST /waitlist', () => {
  let app, request;

  beforeEach(() => {
    freshDb();
    app = reloadApp();
    request = supertest.agent(app);
  });

  it('accepts a valid signup and persists it', async () => {
    const res = await request
      .post('/waitlist')
      .set('Accept', 'application/json')
      .send({ name: 'Ada Lovelace', email: 'Ada@Test.com', clubName: 'Bay SF', cityState: 'SF, CA' })
      .expect(200);

    assert.ok(res.body.success);
    const row = db.prepare('SELECT * FROM waitlist_signups').get();
    assert.equal(row.name, 'Ada Lovelace');
    // emailChain normalizes to lowercase
    assert.equal(row.email, 'ada@test.com');
    assert.equal(row.club_name, 'Bay SF');
  });

  it('rejects a missing name', async () => {
    const res = await request
      .post('/waitlist')
      .set('Accept', 'application/json')
      .send({ email: 'noname@test.com' })
      .expect(400);
    assert.match(res.body.error, /name/i);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM waitlist_signups').get().c, 0);
  });

  it('rejects an invalid email', async () => {
    const res = await request
      .post('/waitlist')
      .set('Accept', 'application/json')
      .send({ name: 'Ada', email: 'not-an-email' })
      .expect(400);
    assert.match(res.body.error, /email/i);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM waitlist_signups').get().c, 0);
  });

  it('silently drops a honeypot submission', async () => {
    const res = await request
      .post('/waitlist')
      .set('Accept', 'application/json')
      .send({ name: 'Bot', email: 'bot@test.com', website: 'http://spam.example' })
      .expect(200);
    assert.ok(res.body.success);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM waitlist_signups').get().c, 0);
  });

  it('treats a duplicate email as success without erroring', async () => {
    await request.post('/waitlist').set('Accept', 'application/json')
      .send({ name: 'Ada', email: 'dup@test.com' }).expect(200);
    await request.post('/waitlist').set('Accept', 'application/json')
      .send({ name: 'Ada', email: 'dup@test.com' }).expect(200);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM waitlist_signups').get().c, 1);
  });
});
