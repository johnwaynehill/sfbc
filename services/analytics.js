'use strict';

const { PostHog } = require('posthog-node');
const config = require('../config');

let client = null;

if (config.posthog.apiKey && process.env.NODE_ENV === 'production') {
  client = new PostHog(config.posthog.apiKey, {
    host: config.posthog.host,
    flushAt: 20,
    flushInterval: 10000,
  });
}

/**
 * Track an event in PostHog.
 * No-op when PostHog is not configured.
 */
function track(userId, event, properties = {}) {
  if (!client) return;
  client.capture({
    distinctId: String(userId || 'anonymous'),
    event,
    properties,
  });
}

/**
 * Identify a user in PostHog with traits.
 * No-op when PostHog is not configured.
 */
function identify(userId, properties = {}) {
  if (!client) return;
  client.identify({
    distinctId: String(userId),
    properties,
  });
}

/**
 * Flush pending events and shut down cleanly.
 */
async function shutdown() {
  if (client) {
    await client.shutdown();
  }
}

module.exports = { track, identify, shutdown };
