# GatherBound — Backlog

Prioritized items for sprint planning. Organized by Epic, sized (S/M/L), and prioritized.

> **Priority key:** P0 = next sprint candidates, P1 = near-term, P2 = future
>
> Each item references which [Roadmap milestone](ROADMAP.md) it serves.
> Completed items move to [SHIPPED.md](SHIPPED.md).
> Detailed engineering plan in [MIGRATION-PLAN.md](MIGRATION-PLAN.md).

---

## Observability & Demand Signal
*Roadmap: Milestone 5 — Observe & Signal*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P0 | S | PostHog server-side integration | `posthog-node` — track review_submitted, vote_cast, nomination_created, user_login, reaction_added, reply_created |
| P0 | S | PostHog client-side snippet | Browser snippet in app shell for page views + session recording |
| P0 | S | Sentry error tracking | `@sentry/node` — request handler + error handler middleware |
| P0 | M | GatherBound landing page | Platform landing page with value prop, SF club screenshots, waitlist form (Tally/Typeform) |

## Multi-Club Data Model
*Roadmap: Milestone 6 — Multi-Club Foundation*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P0 | S | Production SQLite backup | Fly.io snapshot before any migration work |
| P0 | S | Smoke test script | `scripts/smoke-test.js` — hit 10-15 critical routes, assert 200s |
| P0 | S | `clubs` table + seed SF club | Migration 022 — slug, name, tagline, artifact_type, meetup_url |
| P0 | S | `club_memberships` table | Migration 023 — club_id + user_id + role; seed all existing users |
| P0 | S | `is_platform_admin` on users | Migration 024 — distinguish platform admins from club organizers |
| P0 | S | `services/clubs.js` | getClubBySlug, getMembership, getClubMembers, addMember, createClub |
| P0 | L | Add `club_id` to all club-owned tables | Migrations 025-028 — monthly_picks, meetings, events, nominations, votes, reviews, review_replies, emoji_reactions, announcements, invites |
| P0 | L | Scope all service queries to `club_id` | Every service function gets `clubId` param + WHERE clause |
| P0 | S | Temporary hardcoded SF club ID | Config module exports SF_CLUB for routes; replaced by middleware in Sprint 15 |

## Multi-Club Routes & Platform
*Roadmap: Milestone 7 — Multi-Club Platform*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | M | `ClubContext` middleware | `middleware/club-context.js` — resolve club from `:clubSlug`, load membership |
| P1 | L | Route restructure to `/c/:clubSlug` | All club routes mount under prefix; platform routes stay at root |
| P1 | S | `clubPath()` template helper | EJS helper for all internal links — `<%- clubPath('/history') %>` |
| P1 | M | Update all EJS template links | Every `href="/..."` wrapped with `clubPath()` across all templates |
| P1 | S | 301 redirects from old URLs | Old single-club URLs redirect to `/c/sf-fantasy-scifi/...` |
| P1 | S | Update QR code generation | Admin QR panel generates URLs with club prefix |
| P1 | M | Platform admin dashboard | `/platform/clubs` — list, create, edit clubs; gated by `is_platform_admin` |
| P1 | M | Club-scoped invite flow | Invite creation + acceptance scoped to club; join adds to `club_memberships` |
| P1 | S | Onboard club #2 | Create via platform admin, share invite, promote organizer — validate zero-code onboarding |

---

## Post-Validation Features
*Roadmap: Milestone 9 — Product Expansion (prioritize by multi-club user feedback)*

## Book Experience

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | M | Tag-based filtering on History | Tap a tag → filter the grid. Needs 60+ books to justify. |
| P2 | M | Author page | `/books/:authorSlug/` — all books by that author. Needs repeat authors. |

## Reviews

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | S | Emoji flurry for A+ books | Celebratory animation on high-scoring book pages |

## Profiles & Identity

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | L | More robust profiles | Richer member pages with stats, favorites, reading history |
| P2 | M | Photo upload avatars | Alongside existing DiceBear options |
| P2 | S | Pick any DiceBear avatar | All styles via DiceBear JS library (currently 24 of many) |

## Social & Community

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | L | Reading status per member | Reading, Read, DNF, Did Not Read — per-member tracking |
| P2 | M | User-submitted discussion questions | Members contribute questions for the current book |

## Admin & Operations

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | M | Full migration off meetings table | Complete the decoupling — admin edit details writes to events only |
| P2 | M | Admin should be able to see all past Nominations and allow for re-nominating quickly | faster nominations |

## Meetings & In-Person

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | M | Facilitator role | Per-meeting designation; access to guides and tools |
| P2 | M | Club calendar view | Visual calendar of past and upcoming meetings |
| P2 | L | Meetup.com data pull | Attendee count, rating — cached weekly |
| P2 | S | Meeting check-in button | Attendees confirm presence, counts at both Pick level and Meeting level. |
| P2 | L | Discussion guide with questions | User-submitted, sourced, AI-generated |
| P2 | M | Ice-breaker question generator | AI-generated, book-specific, tone selection |

## UX Polish

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | M | @ mentions | Mention another user in replies |
| P2 | M | Add haptics on key interactions for mobile users | https://haptics.lochie.me/ |

## Bugs

*See also [Bugs.md](Bugs.md) for field-reported issues.*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| — | — | *No open P1 bugs* | — |

---

## Sprint History

| Sprint | Focus | Key Items |
|--------|-------|-----------|
| 1 | Schema migration | `monthly_picks` table, read-side swap |
| 2 | State machine | Lifecycle migrated from meetings to picks |
| 3 | Route migration | Public routes + admin UI on picks |
| 4 | Lifecycle reorder | Scheduled status, event tracking |
| 5 | Quick wins + bugs | Metadata cleanup, book nav, my-reviews filter, toggle, --amber fix |
| 6 | Book page as destination | Immersive hero, CTA buttons, inline metadata, external links, share, login prompts, nomination search + edit, rationale display |
| 7 | Reviews polish + metadata | DNF checkbox + badge, spoiler filter polish, grade axis tooltips, reply markdown helper, publisher/language metadata, Samsung light mode fix, migration FK safeguard |
| 8 | Community & polish | Community stats on Home, view own profile link, masked admin emails, styled dialog modals, home hero redesign |
| 9 | Admin QoL, members directory, UX polish | Reaction/reply button polish, admin pagination, profile settings UX, public members directory, password signup fix |
| 10 | Content & admin | Display name collision detection, admin cover replace, invite links, events CRUD on picks, home hero event enrichment |
| 11 | Bug fixes & UX polish | Email + alias fix, remove View Site nav link, enlarge Coming Up covers, unified edit/cover modal |
| 12 | Features & usability | Password toggle, extended markdown, library checkout link, usernames |
| **13** | **Observability + demand signal** | **PostHog, Sentry, GatherBound landing page** |
| **14** | **Multi-club data model** | **Clubs table, memberships, club_id scoping, service query updates** |
| **15** | **Multi-club routes + platform** | **ClubContext middleware, /c/:clubSlug routes, platform admin, invite flow, onboard club #2** |
