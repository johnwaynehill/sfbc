# GatherBound — Roadmap

> **[VISION.md](VISION.md)** — Why we exist and where we're headed.
> **[PRD.md](PRD.md)** — Full product specification.
> **[BACKLOG.md](BACKLOG.md)** — Prioritized items for sprint planning.
> **[SHIPPED.md](SHIPPED.md)** — Everything we've built so far.
> **[MIGRATION-PLAN.md](MIGRATION-PLAN.md)** — Detailed multi-club migration engineering plan.

---

## Where We Are

GatherBound has a working product serving the SF Fantasy & Sci-Fi Book Club (900+ members, ~25 per meeting). Across 12 sprints, we shipped the full core loop and a rich feature set: nomination → voting → reading → results lifecycle via a state machine, letter-grade reviews with markdown and spoiler support, emoji reactions, threaded replies, real-time activity feed, DiceBear avatars, public member profiles with usernames, dark mode, admin panel with pagination and mobile responsiveness, invite links, library checkout links, and a browseable 30+ book archive with immersive book pages.

**The single-club product is strong.** All P0 and P1 items are shipped. No open P1 bugs. The question is no longer "does the app work?" — it's "do other clubs want this?"

The **artifacts-as-center architecture** is proven. Books are the primary entity; meetings are instances attached to monthly picks. Reviews, reactions, and replies link to books, not meetings. Canonical URL slugs and a permanent archive are in place. This foundation was designed to generalize — now we're going to prove it.

**The strategic pivot:** Rather than continuing to polish features for one club, we're moving to validate GatherBound as a multi-club platform. The fastest path to understanding whether this is a real startup opportunity is to onboard 10-20 clubs and measure activation, engagement, and retention.

---

## Strategic Milestones

### Milestone 5: Observe & Signal (Sprint 13)

*Vision principle: "The archive is the product" — you can't improve what you don't measure.*

Before building multi-club, instrument the product and create a public presence. Start learning immediately while the engineering work happens in parallel.

**Key capabilities:**
- PostHog product analytics (server + client) — baseline metrics for SF club, ready for new clubs
- Sentry error tracking — know when things break before users tell you
- GatherBound landing page — public presence explaining the platform with waitlist form
- Outreach to 10+ book club organizers (Reddit, Meetup, personal network)

**Why this is first:** Every sprint after this generates data. Without observability, you're building blind. Without a landing page, you have nothing to share when an organizer says "tell me more."

---

### Milestone 6: Multi-Club Foundation (Sprint 14)

*Vision principle: "The community is always bigger than the room" — and there are thousands of rooms.*

Transform the database layer into a multi-tenant system while keeping the app functionally identical for the SF club. This is the invisible infrastructure sprint — users notice nothing, but the platform becomes capable of hosting any number of clubs.

**Key capabilities:**
- Safety net — production backup, smoke test script
- `clubs` table with SF club seeded
- `club_memberships` table with all existing users migrated
- `club_id` on all club-owned tables (picks, meetings, reviews, nominations, votes, etc.)
- All service queries scoped to `club_id`
- Temporary hardcoded SF club ID in routes (replaced in Milestone 7)

**Why this order:** The data model is the foundation. Getting `club_id` into every query while the app is still single-club means you can test thoroughly against a known-good state. No user-facing changes = low risk.

> See [MIGRATION-PLAN.md](MIGRATION-PLAN.md) Phases 1-3 for detailed engineering plan.

---

### Milestone 7: Multi-Club Platform (Sprint 15)

*Vision principle: "Participation doesn't require attendance" — and now, neither does running a club.*

The app becomes a true platform. Routes move under `/c/:clubSlug`, a platform admin dashboard lets you create clubs, and the invite system becomes club-scoped. At the end of this milestone, onboarding a new club requires zero code changes.

**Key capabilities:**
- `ClubContext` middleware resolving club from URL slug
- All routes restructured under `/c/:clubSlug/`
- `clubPath()` template helper for all internal links
- 301 redirects from old single-club URLs
- Platform admin dashboard (create, list, edit clubs)
- Club-scoped invite flow (join link → membership)
- Updated QR code generation with club prefix
- Onboard club #2 — validate the full flow end-to-end

**Why this is one sprint:** With Claude Code handling the mechanical route/template refactoring, the main work is the `ClubContext` middleware and platform admin CRUD. The route restructure is a pattern-based transform across files — exactly what AI-assisted development excels at.

> See [MIGRATION-PLAN.md](MIGRATION-PLAN.md) Phases 4-6 for detailed engineering plan.

---

### Milestone 8: Validate & Learn (Post-Sprint 15)

*Not a sprint — an ongoing process.*

With 5-20 clubs on the platform, the focus shifts from building to learning.

**Key questions to answer:**
- Can organizers run a full nomination → voting → reading → results cycle independently?
- Do their members engage (reviews, reactions, replies)?
- What's the activation rate? (organizer signs up → first completed cycle)
- What features do they ask for that we don't have?
- Would they pay for this?

**How we measure:**
- PostHog dashboards per club: page views, event counts, funnel completion
- Weekly organizer interviews
- Activation metric: club completes first full artifact cycle within 30 days

**Outcome determines next steps:**
- 3+ clubs complete a cycle and ask for more → Build Milestone 9 (product expansion)
- Clubs sign up but don't activate → Solve the onboarding problem
- Can't find organizers who want this → Market signal is clear

---

### Milestone 9: Product Expansion (Post-Validation)

*Only after Milestone 8 validates demand.*

Invest in features that new clubs ask for and that deepen engagement across the platform.

**Likely candidates (to be prioritized by user feedback):**
- Reading status per member (Reading, Read, DNF, Did Not Read)
- Richer member profiles with cross-club identity
- Club calendar view
- Discussion questions (user-submitted, AI-generated)
- Facilitator role and meeting tools
- Artifact-type expansion readiness (film clubs, album clubs)

**Deferred from earlier milestones:**
- Tag-based filtering on History (needs larger archive)
- Author pages (needs repeat authors)
- Photo upload avatars (nice-to-have, not activation-critical)
- @ mentions in replies

---

## Previous Milestones (Shipped)

### ~~1. The Book Page is the Destination~~ ✅ Largely Shipped

Shipped across Sprints 5-7, 12: immersive book hero, CTA buttons, inline metadata, external links, share, login prompts, nomination search, extended markdown, library checkout links. Remaining items (tag filtering, author pages) deferred to post-validation — they need archive scale to justify.

### ~~2. Every Member Belongs~~ ✅ Partially Shipped

Shipped across Sprints 8-10, 12: public member profiles, DiceBear avatars, social links, display names, usernames, members directory, invite links. Remaining items (reading status, photo upload, richer profiles) moved to Milestone 9 — they're engagement features best prioritized by real multi-club feedback.

### ~~3. The Meeting Gets Better~~ Deferred

Not started. Facilitator role, calendar view, discussion guides, ice-breakers, Meetup data pull. These features matter more when multiple clubs are running meetings. Moved to Milestone 9.

### ~~4. Polish & Platform~~ ✅ Partially Shipped

Shipped: styled dialog modals, home hero redesign, admin pagination. Remaining polish items (@ mentions, haptics) moved to Milestone 9. Platform capabilities (multi-club) promoted to Milestones 6-7 as the strategic priority.

---

## When to Migrate to Postgres

SQLite is correct for the current scale (10-20 clubs, ~25 members each). Revisit when:
- Horizontal scaling needed (multiple Fly.io machines)
- 50+ clubs with concurrent write pressure
- Full-text search beyond SQLite FTS5
- Platform hosting change (Railway, etc.)

See [MIGRATION-PLAN.md](MIGRATION-PLAN.md) § "When to Migrate to Postgres" for full criteria.

---

## Parked Ideas

Ideas that don't justify effort now but are architecturally noted:

| Idea | Why it's parked |
|---|---|
| Custom emoji | Needs admin approval flow, low impact at current scale |
| User blocking | Safety feature — revisit when clubs have unknown members |
| Saved quotes from books | Compelling but niche; needs UI design work |
| Badges & gamification | Needs check-in feature first |
| StoryGraph integration | No stable public API |
| Supporter/premium tier | No monetization pressure yet |
| Self-serve club creation | Build after validating manual onboarding works |
| Postgres migration | Not needed at current scale; see criteria above |

---

## How We Work

- **Sprint planning** pulls from [BACKLOG.md](BACKLOG.md), which has every item sized and prioritized
- **Sprint plans** live in `.claude/plans/` as ephemeral working docs
- **Completed work** moves from BACKLOG → [SHIPPED.md](SHIPPED.md) each sprint
- **Bugs** are tracked in [Bugs.md](Bugs.md) for field-reported issues
- **Migration engineering details** are in [MIGRATION-PLAN.md](MIGRATION-PLAN.md)
