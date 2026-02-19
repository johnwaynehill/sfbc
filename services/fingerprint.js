'use strict';

const crypto = require('crypto');
const config = require('../config');

const COOKIE_NAME = '_client_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Get or create a persistent client ID cookie, then derive a per-meeting
 * fingerprint via HMAC. This prevents a single browser from submitting
 * multiple nominations (or votes) for the same meeting without requiring login.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number|string} meetingId
 * @returns {string} hex fingerprint
 */
function getFingerprint(req, res, meetingId) {
  let clientId = req.cookies[COOKIE_NAME];

  if (!clientId) {
    clientId = crypto.randomUUID();
    res.cookie(COOKIE_NAME, clientId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    });
  }

  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`${clientId}:${meetingId}`)
    .digest('hex');
}

module.exports = { getFingerprint };
