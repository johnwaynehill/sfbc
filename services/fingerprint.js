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

/**
 * Derive a privacy-preserving per-meeting hash of the requester's IP. Used as a
 * soft, review-only signal to surface IP clustering in the admin votes
 * inspector — never to auto-reject a vote. Stores HMAC(secret, "ip:<ip>:<id>"),
 * never the raw IP; salting by meetingId prevents cross-meeting correlation.
 *
 * Relies on `app.set('trust proxy', 1)` so req.ip reflects the real client IP
 * behind Fly's HTTPS termination. Returns null when no IP is available.
 *
 * @param {import('express').Request} req
 * @param {number|string} meetingId
 * @returns {string|null} hex hash, or null if no IP
 */
function getIpHash(req, meetingId) {
  const ip = (req && req.ip) || '';
  if (!ip) return null;

  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`ip:${ip}:${meetingId}`)
    .digest('hex');
}

module.exports = { getFingerprint, getIpHash };
