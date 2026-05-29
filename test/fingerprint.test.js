'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('./setup'); // patches config (sessionSecret = 'test-secret')

const { getFingerprint, getIpHash } = require('../services/fingerprint');

/** Minimal req/res doubles that mimic what getFingerprint touches. */
function makeReq(cookies = {}) {
  return { cookies };
}
function makeRes() {
  const calls = [];
  return {
    cookieCalls: calls,
    cookie(name, value, opts) { calls.push({ name, value, opts }); },
  };
}

// Recompute the expected fingerprint the same way the service does.
function expectedFp(clientId, meetingId) {
  return crypto
    .createHmac('sha256', 'test-secret')
    .update(`${clientId}:${meetingId}`)
    .digest('hex');
}

describe('fingerprint service', () => {
  describe('with an existing _client_id cookie', () => {
    it('derives a deterministic HMAC of clientId:meetingId', () => {
      const req = makeReq({ _client_id: 'client-abc' });
      const res = makeRes();
      const fp = getFingerprint(req, res, 42);
      assert.equal(fp, expectedFp('client-abc', 42));
    });

    it('does not set a new cookie when one already exists', () => {
      const res = makeRes();
      getFingerprint(makeReq({ _client_id: 'client-abc' }), res, 1);
      assert.equal(res.cookieCalls.length, 0);
    });

    it('is stable across repeated calls for the same client + meeting', () => {
      const a = getFingerprint(makeReq({ _client_id: 'c1' }), makeRes(), 7);
      const b = getFingerprint(makeReq({ _client_id: 'c1' }), makeRes(), 7);
      assert.equal(a, b);
    });

    it('differs across meetings for the same client', () => {
      const m1 = getFingerprint(makeReq({ _client_id: 'c1' }), makeRes(), 1);
      const m2 = getFingerprint(makeReq({ _client_id: 'c1' }), makeRes(), 2);
      assert.notEqual(m1, m2);
    });

    it('differs across clients for the same meeting', () => {
      const a = getFingerprint(makeReq({ _client_id: 'alice' }), makeRes(), 1);
      const b = getFingerprint(makeReq({ _client_id: 'bob' }), makeRes(), 1);
      assert.notEqual(a, b);
    });

    it('treats numeric and string meeting IDs identically', () => {
      const asNum = getFingerprint(makeReq({ _client_id: 'c1' }), makeRes(), 5);
      const asStr = getFingerprint(makeReq({ _client_id: 'c1' }), makeRes(), '5');
      assert.equal(asNum, asStr);
    });
  });

  describe('without a _client_id cookie', () => {
    it('mints a new client id and sets it as an httpOnly cookie', () => {
      const res = makeRes();
      getFingerprint(makeReq({}), res, 1);

      assert.equal(res.cookieCalls.length, 1);
      const call = res.cookieCalls[0];
      assert.equal(call.name, '_client_id');
      assert.ok(call.value, 'a client id should be generated');
      assert.equal(call.opts.httpOnly, true);
      assert.equal(call.opts.sameSite, 'lax');
      assert.ok(call.opts.maxAge > 0);
    });

    it('returns a fingerprint consistent with the freshly minted client id', () => {
      const res = makeRes();
      const fp = getFingerprint(makeReq({}), res, 99);
      const mintedId = res.cookieCalls[0].value;
      assert.equal(fp, expectedFp(mintedId, 99));
    });

    it('generates distinct client ids on separate cookieless requests', () => {
      const res1 = makeRes();
      const res2 = makeRes();
      getFingerprint(makeReq({}), res1, 1);
      getFingerprint(makeReq({}), res2, 1);
      assert.notEqual(res1.cookieCalls[0].value, res2.cookieCalls[0].value);
    });

    it('produces a 64-char hex fingerprint (sha256)', () => {
      const fp = getFingerprint(makeReq({}), makeRes(), 1);
      assert.match(fp, /^[0-9a-f]{64}$/);
    });
  });

  describe('getIpHash', () => {
    it('is deterministic for the same ip + meeting', () => {
      const a = getIpHash({ ip: '203.0.113.7' }, 1);
      const b = getIpHash({ ip: '203.0.113.7' }, 1);
      assert.equal(a, b);
      assert.match(a, /^[0-9a-f]{64}$/);
    });

    it('differs across meetings for the same ip (per-meeting salt)', () => {
      const m1 = getIpHash({ ip: '203.0.113.7' }, 1);
      const m2 = getIpHash({ ip: '203.0.113.7' }, 2);
      assert.notEqual(m1, m2);
    });

    it('differs across ips for the same meeting', () => {
      const a = getIpHash({ ip: '203.0.113.7' }, 1);
      const b = getIpHash({ ip: '198.51.100.4' }, 1);
      assert.notEqual(a, b);
    });

    it('never returns the raw IP (privacy)', () => {
      const ip = '203.0.113.7';
      const hash = getIpHash({ ip }, 1);
      assert.ok(!hash.includes(ip));
    });

    it('returns null when no IP is available', () => {
      assert.equal(getIpHash({ ip: '' }, 1), null);
      assert.equal(getIpHash({}, 1), null);
      assert.equal(getIpHash(null, 1), null);
    });
  });
});
