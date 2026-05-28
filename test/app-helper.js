'use strict';

/**
 * Integration test helper — loads the Express app with the test database.
 *
 * MUST be required AFTER test/setup.js (which patches the db module).
 *
 * Usage:
 *   const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee, seedVote } = require('./setup');
 *   const { getApp, loginAs } = require('./app-helper');
 *
 *   const app = getApp();
 *   const agent = supertest.agent(app);
 *   await loginAs(agent, user);
 */

const { db } = require('./setup');

let _app = null;

/**
 * Get the Express app (lazy-loaded, cached).
 * The test/setup.js module must be required first to patch db + config.
 */
function getApp() {
  if (!_app) {
    _app = require('../app');
  }
  return _app;
}

/**
 * Reload the app after a freshDb() call.
 * Clears the cached app module so routes re-require services with the new DB.
 */
function reloadApp() {
  const path = require('path');
  const projectRoot = path.join(__dirname, '..');
  const dbModulePath = require.resolve('../db');
  const configModulePath = require.resolve('../config');

  // Clear all project modules except test/, db (patched), and config (patched)
  for (const key of Object.keys(require.cache)) {
    if (
      key.startsWith(projectRoot) &&
      !key.includes('node_modules') &&
      !key.startsWith(__dirname) &&
      key !== dbModulePath &&
      key !== configModulePath
    ) {
      delete require.cache[key];
    }
  }

  _app = require('../app');
  return _app;
}

/**
 * Log in as a user by setting the session directly.
 * Creates a session via the password login endpoint.
 *
 * @param {import('supertest').SuperAgentTest} agent - supertest agent (cookies persist)
 * @param {object} user - user object with at least { email }
 * @param {string} [password] - password to use (defaults to 'testpass123')
 */
async function loginAs(agent, user, password = 'testpass123') {
  // Ensure user has a password set
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync(password, 4); // low cost for speed in tests
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  const res = await agent
    .post('/auth/password-login')
    .send({ email: user.email, password })
    .expect(200);

  return res;
}

module.exports = { getApp, reloadApp, loginAs };
