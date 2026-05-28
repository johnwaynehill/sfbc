# GatherBound — Testing

How the test suite is structured, how to run it, and how to add to it.

Read this alongside:
- **ARCHITECTURE.md** — stack, bootstrap, services, routing
- **Tech-Specs.md** — data model and API contracts

---

## 1. Overview

The suite uses **Node's built-in test runner** (`node --test`) with `node:assert/strict`. There is **no test framework dependency** (no Jest, no Mocha) — consistent with the project's zero-build-step philosophy. The only test-specific dependency is **`supertest`** (dev dependency) for driving HTTP requests against the Express app.

Every test runs against a **fresh in-memory SQLite database** with all migrations applied, so tests never touch the on-disk dev or production database and never interfere with each other.

As of this writing: **259 tests across 18 files**, full run in ~2 seconds.

```bash
npm test            # run the whole suite once
npm run test:watch  # re-run on file changes
```

Both scripts pass `--test-force-exit` (see §6).

---

## 2. What's covered

### Service / unit tests

| File | Tests | Focus |
|------|------:|-------|
| `voting.test.js` | 19 | Seeded shuffle determinism, ballot data, vote counting, ranked-results tallying (ties, stale IDs) |
| `meeting-lifecycle.test.js` | 12 | The full state machine: every transition, its guards, winner determination, pick creation |
| `meetings.test.js` | 14 | Meeting CRUD, `getCurrent`, nominee add/remove, cascade delete |
| `monthly-picks.test.js` | 16 | Hero selection + fallback, adjacent picks, recent picks, events CRUD with ownership checks |
| `reviews.test.js` | 10 | Review create/update/delete, grade scale, spoiler/DNF flags |
| `reactions.test.js` | 10 | Toggle on/off, batch counts, per-user reactions, reactor listing |
| `replies.test.js` | 11 | Create/update/remove, batch grouping & counts, null-on-miss |
| `activity.test.js` | 8 | Feed item shapes for all four types, anonymous-nomination exclusion, limit handling |
| `announcements.test.js` | 12 | CRUD, `getActive` expiry + active filtering + 3-item cap, creator join |
| `fingerprint.test.js` | 10 | HMAC determinism, per-meeting/per-client divergence, cookie minting |
| `books.test.js` | 15 | `findOrCreateBook` dedup + slug collisions; search no-op without key; mocked-fetch parsing |
| `integrations.test.js` | 6 | `analytics` and `email` no-op / console-fallback behavior without config |
| `utils.test.js` | 25 | `slugify`, date/month formatting, month-year slug round-trips |
| `migrations.test.js` | 3 | All migrations apply cleanly, required tables exist, grade scale is complete |

### Integration (HTTP) tests

These import the real Express app (see §4) and drive it with `supertest`.

| File | Tests | Focus |
|------|------:|-------|
| `routes-api.test.js` | 28 | Nominations, voting, admin lifecycle, reviews, reactions via HTTP — including auth guards and validation |
| `routes-pages.test.js` | 25 | Page rendering, lifecycle-aware redirects, auth flow (login/logout/registration), admin guards, 404 |
| `routes-empty-state.test.js` | 22 | Every key page rendered in its **empty / fresh-database state** — catches EJS crashes on missing data |
| `routes-sse.test.js` | 13 | SSE stream guards (invalid ID → 400, wrong status → 404, admin auth) and initial-payload shapes |

---

## 3. The test harness (`test/setup.js`)

Services prepare SQL statements at module load time (`const stmt = db.prepare(...)`), so the database has to exist **before** any service is required. The harness solves this by patching the module cache:

1. **In-memory DB.** `createTestDb()` opens an `:memory:` SQLite database and runs every migration in `db/migrations/` against it.
2. **`db` module proxy.** The real `db/index.js` export is replaced in `require.cache` with a `Proxy` that forwards every property access to the *current* in-memory database. Services that `require('../db')` transparently get the test DB.
3. **`config` module patch.** `config/index.js` is replaced with a static test config (`nodeEnv: 'test'`, in-memory DB path, no PostHog/SMTP/Google keys) so nothing reads `.env` or reaches the network.
4. **`freshDb()`.** Closes the old DB, creates a new one, and clears every project module from `require.cache` (except the patched `db`/`config`). Call it in `beforeEach` so each test re-requires its services against a clean database.

### Seed helpers

`test/setup.js` exports small helpers so tests stay readable:

```js
const { db, freshDb, seedUser, seedBook, seedMeeting,
        seedNominee, seedVote, seedReview } = require('./setup');
```

| Helper | Creates |
|--------|---------|
| `seedUser({ email, display_name, role, password_hash })` | a user row |
| `seedBook({ title, author, cover_url })` | a book row with slugs |
| `seedMeeting({ month_year, status })` | a meeting row |
| `seedNominee(meetingId, bookId, { userId, reason, nominator_name })` | a nominee (+ nomination) |
| `seedVote(meetingId, rankingBookIds, fingerprint)` | a vote row |
| `seedReview(bookId, userId, { grade, body, has_spoilers, did_finish })` | a review row |

`db` is the proxy — use it for arbitrary queries/assertions inside a test.

---

## 4. The integration harness (`test/app-helper.js`)

`server.js` only does process-level concerns (Sentry init, migrations, `app.listen`). The Express app itself lives in **`app.js`** and is exported without starting a listener, so tests can mount it directly.

```js
const { reloadApp, loginAs } = require('./app-helper');
const app = reloadApp();        // fresh app bound to the current test DB
const agent = supertest.agent(app);
await loginAs(agent, adminUser); // sets a real session via /auth/password-login
```

- **`reloadApp()`** clears the cached `app` module (and its route/service deps) and re-requires it, so the app binds to the database created by the most recent `freshDb()`. Call it after `freshDb()` in `beforeEach`.
- **`loginAs(agent, user, password?)`** gives the user a bcrypt password hash (low cost for speed) and logs in through the real password-login route, so the agent carries a valid session cookie.

For SSE tests, `routes-sse.test.js` starts the app on an ephemeral port, reads the first event off the stream, then destroys the socket — so the always-open streams don't block the test.

---

## 5. Writing a new test

### A service test

```js
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, seedBook, seedUser } = require('./setup');

let reviews;

describe('reviews service', () => {
  beforeEach(() => {
    freshDb();
    reviews = require('../services/reviews'); // re-require AFTER freshDb
  });

  it('creates a review', () => {
    const user = seedUser();
    const book = seedBook();
    reviews.create(book.id, user.id, 'A', 'Great', false, true);
    assert.equal(reviews.getByBookAndUser(book.id, user.id).grade, 'A');
  });
});
```

**Key rule:** require the service *inside* `beforeEach` (after `freshDb()`), not at the top of the file — otherwise it binds to a database that gets closed. Pure functions (e.g. `seededShuffle`, `slugify`) are the exception and can be imported once at the top.

### An HTTP test

```js
const supertest = require('supertest');
const { freshDb, seedUser } = require('./setup');
const { reloadApp, loginAs } = require('./app-helper');

let app;
beforeEach(() => { freshDb(); app = reloadApp(); });

it('rejects an unauthenticated review', async () => {
  const book = seedBook();
  await supertest(app)
    .post(`/api/books/${book.id}/reviews`)
    .send({ grade: 'A' })
    .expect(302); // redirected to login
});
```

### Regression-driven workflow

When a bug surfaces (e.g. a meeting-night crash), the fastest durable fix is:
1. Write a test that reproduces it (it should fail).
2. Fix the code until the test passes.
3. The bug can't silently return — the test guards it permanently.

The empty-state file (`routes-empty-state.test.js`) is the natural home for "page X crashed when there was no data" bugs.

---

## 6. Gotchas

- **`--test-force-exit` is required.** The SQLite session store and `supertest`'s sockets keep open handles that otherwise prevent the test runner from exiting (it hangs until a timeout). Both `npm test` scripts pass this flag. The session-store cleanup interval is also disabled when `nodeEnv === 'test'` (see `app.js`).
- **Process isolation.** Node runs each test *file* in its own process, so mutating shared state (e.g. patching `config.googleBooksApiKey` or `global.fetch` in `books.test.js`) can't leak across files. Still restore `global.fetch` in `afterEach` for clarity.
- **No network.** The test config has no API keys, so `books` search functions return `null`/`[]` and `analytics`/`email` no-op. To test parsing logic, stub `global.fetch` and set the key on the patched `config` object before re-requiring the service.

---

## 7. Not yet covered

- **Client-side JavaScript** (ballot drag-and-drop, nomination form, etc.) — would need jsdom or a headless browser; deferred.
- **Deeper admin flows** — bulk results import (preview/commit), force-status override — currently exercised manually.
- **SSE broadcast fan-out** — only the initial payload and guards are tested, not live push to multiple connected clients.
