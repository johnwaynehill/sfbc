# GatherBound — Multi-Club Migration Plan

A concrete, sequenced plan for migrating SF-Book-Club-V3 (single-club, SQLite, Fly.io)
into the GatherBound multi-club platform. Designed to be executed incrementally — each
phase ships to production and the app runs correctly at the end of every step.

**Guiding constraint:** The existing SF club must work throughout. No "big bang" cutover.

**Key decision:** SQLite stays. At 10-20 clubs with ~25 members each, SQLite on a single
Fly.io machine is more than sufficient. Postgres migration is deferred until horizontal
scaling or 50+ clubs justify the operational complexity.

---

## Overview

| Phase | Sprint | What | Risk |
|-------|--------|------|------|
| 0 | 13 | Observability + demand signal | Low |
| 1 | 14 | Safety net — backups, smoke tests | Low |
| 2 | 14 | Clubs table + membership model | Low |
| 3 | 14 | Scope all queries to `club_id` | Medium |
| 4 | 15 | Route restructure to `/c/:clubSlug` | Medium |
| 5 | 15 | Platform admin + invite flow | Low |
| 6 | 15 | Onboard club #2 | Low |

Estimated total: **3 Claude Code sessions** (Sprints 13-15).

---

## Phase 0 — Observability + Demand Signal (Sprint 13)

**Goal:** Start learning before building. Instrument the current app, create a public
presence, and begin outreach to potential clubs — all while the app stays single-club.

### 0.1 PostHog integration

Install `posthog-node` for server-side event tracking and add the PostHog browser
snippet to the app shell for page views and session recording.

**Server-side events to track:**
- `review_submitted` — grade, book_id, has_body
- `vote_cast` — meeting_id
- `nomination_created` — meeting_id, has_rationale
- `user_login` — method (magic_link / password)
- `reaction_added` — emoji, review_id
- `reply_created` — review_id

These events give you a baseline for SF club engagement AND become the foundation
for tracking new club activation later.

**Environment variable:** `POSTHOG_API_KEY`

### 0.2 Sentry integration

Install `@sentry/node`. Wire up request handler before routes and error handler
after routes. Know when things break before users tell you — especially critical
during the migration phases that follow.

**Environment variable:** `SENTRY_DSN`

### 0.3 GatherBound landing page

Create a public landing page at the root that:
- Explains what GatherBound does (artifact-centered club platform)
- Shows screenshots/proof from the SF club (social proof)
- Has a "Start your club" waitlist form (Tally or Typeform embed)
- Links to your contact info for organizers

**Important:** This page lives at a route that won't conflict with the future
`/c/:clubSlug` structure. The root `/` becomes the platform landing page;
the SF club moves to `/c/sf-fantasy-scifi` in Phase 4.

### 0.4 Outreach (parallel, not code work)

While Sprint 13 ships:
- Reddit: r/bookclub, r/52book, r/fantasy, r/printSF
- Meetup: search for book clubs in SF, Oakland, NYC, LA, Chicago
- Personal network — anyone who runs a recurring club
- The landing page gives you something to link to

### Phase 0 done when:
- PostHog tracks events on the live SF club site
- Sentry catches errors in production
- Landing page is live with a waitlist form
- You've personally contacted 10+ club organizers

---

## Phase 1 — Safety Net (Sprint 14, first step)

Do this before touching any data model. It's quick work that saves you if something
goes wrong.

### 1.1 Create a migration branch

```bash
git checkout -b feat/multi-club-migration
```

All migration work on this branch. Main stays deployable throughout.

### 1.2 SQLite snapshot

```bash
# On Fly.io — download current production DB before any changes
fly ssh console -C "cp /data/bookclub.sqlite /data/bookclub-pre-migration.sqlite"
fly sftp get /data/bookclub.sqlite ./backups/bookclub-$(date +%Y%m%d).sqlite
```

Keep this backup locally. You can restore the entire production state from it.

### 1.3 Write a smoke test script

Create `scripts/smoke-test.js` — hits 10-15 critical routes, asserts HTTP 200.
Run it before and after every phase.

Key routes:
- `GET /` (home)
- `GET /history`
- `GET /books/:authorSlug/:titleSlug` (a real book from the archive)
- `GET /members/:username`
- `GET /login`
- `GET /admin` (with admin session cookie)
- `GET /api/health`

### Phase 1 done when:
- Production DB backed up locally
- Smoke test script runs in <30 seconds and passes

---

## Phase 2 — Clubs Table + Membership Model (Sprint 14)

**Goal:** Introduce the multi-tenancy data model without changing any existing behavior.
The SF club gets a row in the `clubs` table; all existing members get rows in
`club_memberships`. Everything else still works exactly as before.

### 2.1 Migration: create `clubs` table

```sql
-- db/migrations/022-clubs.sql

CREATE TABLE IF NOT EXISTS clubs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  tagline       TEXT,
  artifact_type TEXT NOT NULL DEFAULT 'book',
  meetup_url    TEXT,
  library_url   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the existing SF club
INSERT INTO clubs (slug, name, tagline, artifact_type, meetup_url)
VALUES (
  'sf-fantasy-scifi',
  'SF Fantasy & Sci-Fi Book Club',
  'The community is always bigger than the room.',
  'book',
  'https://www.meetup.com/sf-fantasy-scifi-book-club/'
);
```

### 2.2 Migration: create `club_memberships` table

```sql
-- db/migrations/023-club-memberships.sql

CREATE TABLE IF NOT EXISTS club_memberships (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id    INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'organizer' | 'member'
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_memberships_club_id ON club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user_id ON club_memberships(user_id);

-- Migrate all existing users into the SF club
INSERT INTO club_memberships (club_id, user_id, role)
SELECT
  (SELECT id FROM clubs WHERE slug = 'sf-fantasy-scifi'),
  u.id,
  CASE WHEN u.role = 'admin' THEN 'organizer' ELSE 'member' END
FROM users u;
```

### 2.3 Add `is_platform_admin` to users

```sql
-- db/migrations/024-platform-admin.sql
ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0;
```

Set via `SUPER_ADMIN_EMAIL` env var on startup — the existing `isSuperAdmin`
enrichment in `middleware/auth.js` already handles this pattern. A post-migration
hook can sync the column from the env var.

### 2.4 Create `services/clubs.js`

New service file with functions:
- `getClubBySlug(slug)` — returns active club by slug
- `getClubById(id)` — returns club by ID
- `getMembership(clubId, userId)` — returns membership row
- `getClubMembers(clubId)` — returns members with roles
- `addMember(clubId, userId, role)` — upserts membership
- `createClub({ name, slug, tagline, artifactType, meetupUrl })` — creates a new club
- `getActiveClubs()` — returns all active clubs

All functions use the existing synchronous `db.prepare()` pattern — no API changes.

### Phase 2 done when:
- Clubs and memberships tables exist in SQLite
- SF club has one row; all users have a corresponding membership row
- `getClubBySlug('sf-fantasy-scifi')` returns the correct club
- Smoke tests still pass (nothing changed in the public app yet)

---

## Phase 3 — Scope All Queries to `club_id` (Sprint 14)

**Goal:** Add `club_id` to every club-owned table and update all service queries
to filter by it. After this phase, the app is multi-tenant in the database layer
even if the routes still assume one club.

### 3.1 Which tables get `club_id`

**Get `club_id`:**

| Table | Notes |
|-------|-------|
| `monthly_picks` | Core — every pick belongs to one club |
| `meetings` | Each meeting is club-scoped |
| `events` | Tied to meetings — add directly for query simplicity |
| `nominations` | Club-scoped |
| `votes` | Club-scoped |
| `reviews` | Reviews written within a club context |
| `review_replies` | Scoped via review, but add directly |
| `emoji_reactions` | Same pattern |
| `announcements` | Club-scoped |
| `invites` | Club-scoped |

**Do NOT get `club_id`:**

| Table | Reason |
|-------|--------|
| `books` | Global catalog — canonical, reusable across clubs |
| `users` | Platform-level; membership is in `club_memberships` |
| `grade_weights` | Platform-wide configuration |
| `magic_link_tokens` | Auth infrastructure, not club data |

### 3.2 Migration pattern (repeat for each table)

```sql
-- Example for monthly_picks
ALTER TABLE monthly_picks ADD COLUMN club_id INTEGER REFERENCES clubs(id);

-- Backfill all existing rows with the SF club ID
UPDATE monthly_picks
SET club_id = (SELECT id FROM clubs WHERE slug = 'sf-fantasy-scifi');

-- Note: SQLite doesn't support ALTER COLUMN SET NOT NULL after creation.
-- The NOT NULL constraint is enforced at the application level for existing tables.
-- New inserts will always include club_id via service functions.
```

Suggested migration grouping:

```
025-club-scope-picks-meetings.sql      (monthly_picks, meetings, events)
026-club-scope-nominations-votes.sql   (nominations, votes)
027-club-scope-reviews.sql             (reviews, review_replies, emoji_reactions)
028-club-scope-content.sql             (announcements, invites)
```

Index every `club_id` column for query performance.

### 3.3 Update service queries

Every service file that queries a club-owned table gets a `clubId` parameter and
a `WHERE club_id = ?` filter. The pattern is mechanical:

**Before:**
```javascript
export function getHero() {
  return db.prepare(`
    SELECT mp.*, b.title, b.author, b.cover_url ...
    FROM monthly_picks mp
    JOIN books b ON b.id = mp.book_id
    WHERE mp.status IN ('reading', 'voting', 'nominations')
    ORDER BY mp.created_at DESC LIMIT 1
  `).get();
}
```

**After:**
```javascript
export function getHero(clubId) {
  return db.prepare(`
    SELECT mp.*, b.title, b.author, b.cover_url ...
    FROM monthly_picks mp
    JOIN books b ON b.id = mp.book_id
    WHERE mp.club_id = ?
      AND mp.status IN ('reading', 'voting', 'nominations')
    ORDER BY mp.created_at DESC LIMIT 1
  `).get(clubId);
}
```

**Key advantage of keeping SQLite:** All queries stay synchronous. The only change
per function is adding a `clubId` parameter and a `WHERE` clause — no sync-to-async
rewrite needed.

Service files to update:
- `services/monthly-picks.js` — all pick queries
- `services/meetings.js` — meeting CRUD
- `services/voting.js` — vote submission, tallying
- `services/reviews.js` — review CRUD, grade processing
- `services/replies.js` — reply management
- `services/reactions.js` — emoji reactions
- `services/announcements.js` — announcements
- `services/activity.js` — activity feed queries

### 3.4 Temporary hardcoded club ID in routes

After updating service functions to require `clubId`, routes need to pass it.
Load the SF club once at startup:

```javascript
// config/club.js (temporary — removed in Phase 4)
import { getClubBySlug } from '../services/clubs.js';
const db = require('../db');
export const SF_CLUB = getClubBySlug('sf-fantasy-scifi');
```

Route handlers use `SF_CLUB.id` as the `clubId` argument. This is explicitly
temporary scaffolding — Phase 4 replaces it with middleware.

### Phase 3 done when:
- All club-owned tables have `club_id` column, backfilled, indexed
- All service functions accept `clubId` and filter by it
- Routes pass the SF club ID via the temporary scaffolding
- Smoke tests pass — the live site works identically

---

## Phase 4 — Route Restructure to `/c/:clubSlug` (Sprint 15)

**Goal:** Change the URL structure from `gatherbound.com/history` to
`gatherbound.com/c/sf-fantasy-scifi/history`. Introduce `ClubContext` middleware
that replaces the temporary scaffolding from Phase 3.

This is the most visible change to users. Do it carefully with redirects in place.

### 4.1 `ClubContext` middleware

Create `middleware/club-context.js`:

```javascript
import { getClubBySlug, getMembership } from '../services/clubs.js';

export function resolveClub(req, res, next) {
  const { clubSlug } = req.params;
  if (!clubSlug) return next();

  const club = getClubBySlug(clubSlug);
  if (!club) return res.status(404).render('404', { message: 'Club not found' });

  res.locals.club = club;

  // If user is authenticated, load their club membership
  if (req.session.userId) {
    const membership = getMembership(club.id, req.session.userId);
    res.locals.membership = membership;
    res.locals.isClubMember = !!membership;
    res.locals.isClubOrganizer = membership?.role === 'organizer' || membership?.role === 'owner';
  }

  next();
}
```

### 4.2 New route structure

```javascript
// Platform routes (no club context)
app.use('/', platformRoutes);        // landing page, login, platform admin
app.use('/auth', authRoutes);

// Club-scoped routes
app.use('/c/:clubSlug', resolveClub, clubPublicRoutes);
app.use('/c/:clubSlug', resolveClub, requireMember, clubMemberRoutes);
app.use('/c/:clubSlug/admin', resolveClub, requireClubAdmin, clubAdminRoutes);
app.use('/c/:clubSlug/api', resolveClub, clubApiRoutes);
```

### 4.3 Update route files

Each route file:
1. Replaces `SF_CLUB` scaffolding with `res.locals.club`
2. Route paths stay the same — the club prefix comes from the mount point

### 4.4 `clubPath()` template helper

```javascript
app.use((req, res, next) => {
  res.locals.clubPath = (path) => {
    const club = res.locals.club;
    return club ? `/c/${club.slug}${path}` : path;
  };
  next();
});
```

Every EJS link becomes: `href="<%- clubPath('/history') %>"`

This makes the template migration mechanical — find every `href="/..."` and wrap
it with `clubPath()`.

### 4.5 Redirects for existing URLs

SF club members have bookmarks. Redirect them:

```javascript
const SF_SLUG = 'sf-fantasy-scifi';
const oldRoutes = ['/history', '/books', '/members', '/vote', '/results',
                   '/nominate', '/login', '/profile', '/about', '/changelog'];

for (const route of oldRoutes) {
  app.get(route, (req, res) => res.redirect(301, `/c/${SF_SLUG}${route}`));
}
// Root redirects to club home
app.get('/', (req, res) => res.redirect(301, `/c/${SF_SLUG}`));
```

Note: Once the landing page exists, the root `/` redirect is replaced by the
platform landing page, and users navigate to their club from there.

### 4.6 Update QR code generation

Admin QR panel generates URLs with the new `/c/:clubSlug/` prefix. Since QR codes
are regenerated per meeting, no mass invalidation needed — old QR codes follow
the 301 redirects.

### Phase 4 done when:
- All routes live under `/c/:clubSlug/`
- `ClubContext` middleware replaces the hardcoded scaffolding
- Old URLs redirect correctly to new paths
- All internal template links use `clubPath()` helper
- Admin QR panel generates correct new URLs
- Smoke tests pass against all new route paths

---

## Phase 5 — Platform Admin + Invite Flow (Sprint 15)

**Goal:** Create a way to manage multiple clubs and onboard new clubs without
touching code.

### 5.1 Platform admin dashboard

Create `/platform` routes (separate from `/c/:clubSlug/admin`):

```
/platform/clubs          — list all clubs, create new club
/platform/clubs/:id      — edit club details, view members
/platform/users          — platform-wide user list
```

Gated by `is_platform_admin`. The existing admin shell layout can be reused with
minor branding adjustments.

### 5.2 Club creation flow

Platform admin fills a form: name, slug, tagline, artifact type, meetup URL.
A row is inserted into `clubs`. No self-serve yet — you create clubs manually.
That's correct for private beta with 10-20 clubs.

### 5.3 Club-scoped invite flow

The existing `invites` table has `club_id` from Phase 3. Update the invite
creation and acceptance flows:

- **Create:** `POST /c/:clubSlug/admin/invites` generates a code scoped to the club
- **Accept:** `GET /c/:clubSlug/join/:code` validates the code against the club,
  adds the user to `club_memberships`, redirects to the club home
- **Not logged in:** Store the invite code in session, redirect to login, complete
  the join after authentication

### Phase 5 done when:
- Platform admin can create a new club via UI
- Invite links are club-scoped and work end-to-end
- Accepting an invite adds the user to `club_memberships`
- A second club can be created and onboarded with zero code changes

---

## Phase 6 — Onboard Club #2 (Sprint 15)

By this point, the architecture supports it. Adding a new club is:

1. Create a row in `clubs` via the platform admin UI
2. Share an invite link with the organizer
3. Organizer joins, gets promoted to `owner` role
4. Done — they have a fully functional instance at `/c/their-club-slug/`

No code changes required. Validate this works exactly as described before calling
the migration complete.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed `club_id` filter leaks data between clubs | Medium | High | Grep every service query; smoke test with 2 clubs; manual QA |
| Broken links after URL restructure | Medium | Medium | 301 redirects from all old routes; update sitemap |
| Session invalidation during migration | Low | Low | Same SQLite session store, same secret — cookies stay valid |
| QR codes pointing to old URLs | Medium | Low | Old codes redirect via 301; new codes generated per meeting |
| EJS template links missed in `clubPath()` migration | Medium | Medium | Grep for `href="/` across all templates; automated check |

---

## Environment Variables to Add

| Variable | Phase | Purpose |
|----------|-------|---------|
| `POSTHOG_API_KEY` | 0 | Product analytics |
| `SENTRY_DSN` | 0 | Error tracking |

No new infrastructure variables needed — SQLite stays, Fly.io stays, everything
else is configuration in the existing stack.

---

## When to Migrate to Postgres

SQLite is the right choice today. Revisit when any of these become true:

- **Horizontal scaling** — You need multiple Fly.io machines (SQLite can't share across machines)
- **50+ clubs** — Query complexity and concurrent writes may benefit from Postgres
- **Full-text search** — Beyond what SQLite FTS5 provides
- **Platform move** — Railway or similar where Postgres is bundled
- **Connection pooling** — External services need direct DB access

Until then, SQLite provides sub-millisecond queries, zero operational overhead,
single-file backups, and a synchronous API that keeps the codebase simple.

---

## Definition of Done

The migration is complete when:
- [ ] SF club works identically to today at `/c/sf-fantasy-scifi/`
- [ ] Old URLs redirect cleanly to new club-scoped paths
- [ ] A second club can be created via platform admin with zero code changes
- [ ] New club members can join via invite link
- [ ] PostHog tracks engagement events per club
- [ ] Sentry shows zero new errors 48 hours after each phase deploys
- [ ] Smoke tests pass against production
