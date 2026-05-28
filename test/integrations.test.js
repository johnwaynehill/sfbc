'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('./setup'); // patches config: no posthog key, no smtp host

describe('analytics service (no-op without PostHog config)', () => {
  const analytics = require('../services/analytics');

  it('track does not throw and returns undefined', () => {
    assert.equal(analytics.track('user-1', 'some_event', { a: 1 }), undefined);
  });

  it('track tolerates a missing userId', () => {
    assert.doesNotThrow(() => analytics.track(null, 'event'));
    assert.doesNotThrow(() => analytics.track(undefined, 'event', {}));
  });

  it('identify does not throw and returns undefined', () => {
    assert.equal(analytics.identify('user-1', { plan: 'free' }), undefined);
  });

  it('shutdown resolves without error', async () => {
    await assert.doesNotReject(analytics.shutdown());
  });
});

describe('email service (console fallback without SMTP config)', () => {
  const email = require('../services/email');

  // Silence the dev-mode console output during these tests.
  const origLog = console.log;
  before(() => { console.log = () => {}; });
  after(() => { console.log = origLog; });

  it('sendMagicLink resolves without throwing when SMTP is unconfigured', async () => {
    await assert.doesNotReject(email.sendMagicLink('user@test.com', 'tok-123'));
  });

  it('sendMagicLink returns undefined in console-fallback mode', async () => {
    const result = await email.sendMagicLink('user@test.com', 'tok-456');
    assert.equal(result, undefined);
  });
});
