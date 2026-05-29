SF Fantasy & Sci-Fi Book Club App

## Technical Specifications

This document defines the data model, API contracts, rendering strategy, and infrastructure decisions for the app. It is the authoritative reference for all engineering implementation.

Read this alongside:
- **VISION.md** — product vision, market thesis, and platform strategy
- **PRD.md** — product specification, goals, user stories, page definitions, functional requirements
- **Design-Specs.md** — visual system, design tokens, components, layout patterns
- **Brand-Guidelines.md** — strategic brand foundations
- **Design-Thinking.md** — implementation guidance for the First Edition aesthetic

---

# 1. Technical Requirements

* Backend: Node.js (DreamHost).
* Email: DreamHost mail for magic-links.
* Real-time updates: Server-Sent Events (SSE).
* Responsive UI for mobile.

---

# 2. Data Model (MVP)

The following core entities define the minimal data structure required for implementation. Codex and future contributors should treat these as the canonical domain objects.

## Domain Boundary Rules (Fixes Meeting/Book/Selection confusion)

* **Book** is a canonical entity reused across time (a single book may be nominated in multiple meetings).
* **Meeting** represents the monthly club context (date/time/location/state).
* **Nominations and Votes attach to a Meeting**, and reference Books.
* Meeting-specific facts (e.g., "selected for Feb 2026") must live on Meeting (winner) or Meeting-linked records, not on Book.

Optional but recommended for clarity (MVP-safe):

## MeetingNominee (a.k.a. MeetingBook)

Represents the set of books that are nominees for a given meeting and allows meeting-scoped metadata without polluting Book.

* id
* meeting_id
* book_id
* created_at
* source (nomination | admin_add)

This can be derived from Nominations in MVP, but adding it explicitly keeps the model clean as features grow.

## Meeting

* id
* month_year (e.g., "2026-02")
* meetup_event_url (optional manual entry)
* meeting_time (datetime or text)
* location_text (string)
* status (reading | nominations | voting | results)
* winning_book_id (nullable until finalized)
* nominations_open_at
* nominations_close_at
* voting_open_at
* voting_close_at

## Book

* id
* title
* author
* cover_url
* google_books_id (optional)
* open_library_id (optional)
* publication_year (optional)
* page_count (optional)

## Nomination

* id
* meeting_id
* book_id (or temporary unresolved title/author during entry)
* created_at
* submitted_fingerprint (hashed device/IP identifier for anti-abuse)

## Vote

* id
* meeting_id
* ranking_json (ordered list of book ids)
* created_at
* submitted_fingerprint
* user_id (nullable; set for logged-in voters, NULL for anonymous)
* submitted_ip_hash (nullable; HMAC(secret, "ip:&lt;ip&gt;:&lt;meeting_id&gt;") — never the raw IP)

Uniqueness: `UNIQUE(meeting_id, submitted_fingerprint)` plus a partial unique index `(meeting_id, user_id) WHERE user_id IS NOT NULL` — so a logged-in member gets exactly one vote per meeting regardless of browser/cookie.

`submitted_ip_hash` is a **soft, review-only** signal for anonymous abuse: the admin votes inspector (`?show-votes=yes`) groups votes sharing an IP hash and flags clusters (`⚠ N from network …`) so an admin can manually delete suspected cookie-reset duplicates. Votes are **never auto-rejected** on this value — in-person meetups share one venue IP, so a hard block would reject legitimate attendees. The hash is salted per-meeting (no cross-meeting correlation) and irreversible without the secret. Gross flooding is bounded separately by the per-IP rate-limit backstop.

## Review

* id
* book_id
* user_id
* grade
* body_markdown
* created_at
* updated_at

## User

* id
* email
* display_name
* role (member | admin)
* avatar_style (default: 'initials') — one of 24 DiceBear styles
* password_hash (nullable — bcrypt, optional secondary auth)
* user_slug (unique — generated from display_name for public profile URLs)
* goodreads_url (nullable)
* storygraph_url (nullable)
* instagram_handle (nullable)
* threads_handle (nullable)
* created_at
* updated_at

## MagicLinkToken

* token
* user_id
* expires_at
* used_at

## GradeWeight

* grade (TEXT, e.g., "A+")
* weight (REAL, e.g., 4.0)

Note: 14 grades from F (0.0) to S (4.3). Used for calculating averages and generating grade distribution visualizations. F+ and F- were removed — a failing grade needs no modifiers.

Implementation Guidance:

* Canonical structured data should live in SQLite.
* Markdown is an export/output format.
* All meeting-scoped state (open/closed timestamps, winner, nominees) must be represented in canonical data.

---

# 3. Identity & Duplicate Submission Policy (MVP)

Because nominations and votes do not require login, the app enforces "one submission per person" using a best-effort identity mechanism.

## Best-Effort Identity

* On first visit to a QR flow page, generate a durable **client_id** and store it in a cookie/localStorage.
* Compute **submitted_fingerprint = hash(client_id + server_secret + meeting_id)**.
* Optionally add IP/UA hashed as a fallback signal when client_id is missing.

## Enforcement Rules

* Nominations: 1 per fingerprint per meeting.

  * If a fingerprint has already nominated, show: "Looks like you already nominated for this meeting." and provide an **Edit** flow.
* Votes: 1 per fingerprint per meeting, and additionally 1 per logged-in user per meeting (by `user_id`), so a member cannot re-vote from a different browser/private window.

  * If a fingerprint or the logged-in user has already voted, show: "Vote already received." and provide a **View Results** link.

## Rate Limiting (Best-Effort)

* Apply basic rate limiting on nomination and vote submission endpoints (e.g., per IP per minute) to deter obvious spam.

## Design Principle

* Optimize for in-room social honesty and low friction, not adversarial security.

---

# 4. Routes & API Contracts (MVP)

Define explicit routes so that implementation remains predictable and consistent.

## Public Pages

* GET /
* GET /history
* GET /about
* GET /books/:authorSlug/:titleSlug
* GET /members/:slug (requireMember — public member profile)

## QR Flow Pages

* GET /nominate/:meetingId
* POST /api/meetings/:meetingId/nominations
* GET /vote/:meetingId
* POST /api/meetings/:meetingId/votes
* GET /results/:meetingId
* GET /api/meetings/:meetingId/results (SSE stream for live updates)

## Authentication

* GET /login
* POST /auth/send-link (magic link request)
* GET /auth/verify/:token (magic link verification)
* POST /auth/password-login (email + password login)
* GET /auth/logout

## Profile

* GET /profile (requireMember — edit own profile)
* PUT /api/auth/display-name (also regenerates user_slug)
* PUT /api/auth/avatar-style
* PUT /api/auth/social-links
* PUT /api/auth/password

## Reviews

* POST /api/books/:bookId/reviews
* PUT /api/books/:bookId/reviews (update existing)

## Admin

* GET /admin
* POST /api/admin/meetings (create meeting)
* POST /api/admin/meetings/:meetingId/state (change state)
* POST /api/admin/export (generate markdown snapshot)
* DELETE /api/admin/votes/:id (remove an individual vote; recalculates results)

Admins can inspect individual votes (voter identity + ranking) on a pick's detail page via the hidden query param `?show-votes=yes`, which surfaces a per-vote table with delete controls. No UI link points to it.

Implementation Guidance:

* Prefer predictable REST-style endpoints.
* Server-rendered pages with progressive enhancement are acceptable.

---

# 5. PWA & Offline Behavior (Minimal Implementation)

The application should support a lightweight Progressive Web App (PWA) setup optimized for in-person mobile use.

Goals:

* Improve reliability in environments with weak connectivity.
* Allow installation to home screen for frequent attendees.

Requirements:

* Web App Manifest (installable app).
* Offline caching of static assets and core UI shell.
* Graceful offline behavior for nomination and vote flows.

Offline UX:

* If submission fails due to network issues, store draft locally.
* Automatically retry submission when connectivity returns.
* Provide clear visual feedback when retrying.

Non-Goals for MVP:

* Push notifications.
* Complex offline-first data synchronization.

---

# 6. Rendering Strategy

To minimize complexity (especially on DreamHost) while maximizing speed and reliability on mobile, the app should primarily use server-rendered HTML with progressive enhancement.

## Approach

* Primary rendering: server-rendered pages (Node.js) returning fully usable HTML.
* Progressive enhancement: JavaScript adds quality-of-life improvements (drag-to-reorder, live-updating results, optimistic UI) but core flows remain functional without heavy client frameworks.

## Reasons

* Fast first-load for QR entry and in-person use.
* Fewer moving parts and simpler deployment/hosting.
* Strong baseline accessibility.
* Public history pages remain simple and crawlable.

## Notes

* SSE is used for live results updates.
* Avoid SPA-only navigation requirements.

---

# 7. Canonical URL & Slug Strategy

The app uses human-readable, slug-based URLs for book pages. Book URLs are composed of two slugs — author and title — stored as indexed columns in the database for direct lookup.

## Principles

* Use human-readable slugs as the canonical routing mechanism for books.
* Store `author_slug` and `title_slug` columns in the `books` table with a unique composite index.
* Keep QR URLs short, stable, and meeting-scoped.
* No numeric IDs exposed in public URLs.

## Book URLs

Canonical form:

* `/books/:authorSlug/:titleSlug`

Example:

* `/books/becky-chambers/the-long-way-to-a-small-angry-planet`

Where:

* `authorSlug` is derived from the author name (e.g., "becky-chambers").
* `titleSlug` is derived from the book title (e.g., "the-long-way-to-a-small-angry-planet").

Lookup:

* Query: `WHERE author_slug = ? AND title_slug = ?` — direct indexed lookup, no slug recomputation.
* 404 if no match.

## Meeting URLs

Preferred canonical form:

* /meetings/:meetingId/:monthYear

Where:

* meetingId is canonical.
* monthYear is purely presentational (e.g., "2026-02").

## QR Entry URLs

QR routes should be short and stable:

* /nominate/:meetingId
* /vote/:meetingId
* /results/:meetingId

QR pages may redirect internally based on meeting state, but the public QR URLs must remain stable.

## Markdown Export Paths

Markdown exports should also be stable and predictable:

* /history/:monthYear.md (e.g., /history/2026-02.md)
* Optional: /books/:authorSlug/:titleSlug.md (for portability)

## Editing & Corrections

* If an admin edits a book's title or author, the slugs must be regenerated and the database updated.
* Old slug-based URLs will return 404 (no redirect system for slug changes in v1). This is acceptable since the primary audience shares links within the club.

---

## Slug Generation Rules (Canonical Implementation)

To ensure consistency across links, exports, and QR flows, slug generation must follow deterministic rules.

### Generation Algorithm

* Convert text to lowercase.
* Remove punctuation and special characters except hyphens and spaces.
* Replace spaces with hyphens (`-`).
* Collapse multiple hyphens into a single hyphen.
* Trim leading and trailing hyphens.
* Limit slug length to a reasonable maximum (80 characters).

### Slugs Are Generated Per-Field

* `author_slug` = `slugify(author)`
* `title_slug` = `slugify(title)`

Example:

* "Jade City" by "Fonda Lee" → author_slug: `fonda-lee`, title_slug: `jade-city`
* URL: `/books/fonda-lee/jade-city`

### Collision Handling

The `(author_slug, title_slug)` pair has a unique index. If a collision occurs (same author, same title — very rare):

* Append publication year to title_slug (e.g., `dune-1965`).
* Fallback: append internal bookId (e.g., `dune-123`).

### Helper Functions (Implemented in `utils/slug.js`)

* `slugify(str)` — converts any string to a URL-safe slug.
* `bookPath(title, author)` — returns `/books/${slugify(author)}/${slugify(title)}`.
* Both are passed to templates for generating links.

### Implementation Guidance

* Slug generation is implemented as a shared utility in `utils/slug.js`.
* All routes, templates, and exports must use `slugify()` / `bookPath()` to avoid divergence.
* Slugs are stored in the database at insert time (not computed on every request).

## User Slugs

User profiles use slug-based URLs at `/members/:user_slug`.

* Column: `user_slug TEXT` with unique index on the `users` table (migration 008).
* Generation: `slugify(display_name)` with collision-safe numeric suffix (`jane-doe`, `jane-doe-2`, etc.).
* Backfill: `seedUserSlugs()` in `db/migrate.js` runs on every server start (idempotent — no-op once all users have slugs).
* Update: Slug is regenerated when display name changes via `PUT /api/auth/display-name` (excludes self from collision check).
* Fallback: Uses email prefix if no display name is set, or `'member'` as last resort.

---

# 7A. Database Migrations

Sequential SQL migrations in `db/migrations/` are applied on server start via `db/migrate.js`. Applied migrations are tracked in the `_migrations` table.

Current migrations:
* `001-initial-schema.sql` — Core tables (meetings, books, nominations, votes, reviews, users, magic_link_tokens, grade_weights)
* `002` through `006` — Various schema additions
* `007-profile-enhancements.sql` — Adds `avatar_style`, `goodreads_url`, `storygraph_url`, `instagram_handle`, `threads_handle`, `password_hash` columns to users
* `008-user-slug.sql` — Adds `user_slug` column to users with unique index

Post-migration seeds:
* `seedUserSlugs()` — Backfills `user_slug` for any user missing one

---

# 7B. Authentication System

The app supports two authentication methods:

## Magic Link (Primary)
* User enters email at `/login`
* Server generates a 15-minute expiring token, stores in `magic_link_tokens` table
* Email sent via SMTP with verification link
* `GET /auth/verify/:token` validates token, creates/finds user, establishes session
* Auto-registration: first login creates a new user account with email prefix as display name

## Password (Secondary, Optional)
* Users can set a password in their profile settings
* `POST /auth/password-login` validates email + bcrypt-hashed password
* Minimum 8 characters, bcrypt cost factor 12
* Login page shows toggle: "Use password instead" / "Use magic link instead"

## Admin Authentication
* Bootstrap: `POST /api/admin/bootstrap` (one-time first admin creation with bootstrap key)
* Login: `POST /api/auth/admin-login` (email + password)
* Separate admin shell layout at `/admin/*`

## Session Management
* SQLite session store via `better-sqlite3-session-store`
* HttpOnly cookies, SameSite=Lax, Secure in production
* 30-day session expiration
* Expired session cleanup every 15 minutes

---

# 7C. Dark Mode Implementation

Dark mode uses a dual-selector CSS pattern:

* `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` — respects OS preference unless user chose light
* `[data-theme="dark"] { ... }` — manual dark mode override

Client-side (`public/js/theme.js`):
* FOUC prevention: inline `<script>` in `<head>` reads `localStorage('theme')` and sets `data-theme` before first paint
* Toggle button persists choice to `localStorage`
* Listens for OS preference changes; auto-adapts if no manual choice saved
* Updates `<meta name="theme-color">` for browser chrome

CSS variables in `tokens.css` provide complete light/dark palettes for backgrounds, text, borders, accents, and component-specific colors.

---

# 8. Platform Future (Architectural Awareness)

This section is NOT in scope for v1. It exists to ensure that foundational decisions do not accidentally prevent future scaling. No code should be written for multi-club support in the MVP.

## Vision

The SF Fantasy & Sci-Fi Book Club app is the first instance of a broader product idea: **beautiful, frictionless tools for in-person clubs that transform ephemeral gatherings into lasting cultural records.**

The core flows — nominate, vote, reveal, review, archive — are not specific to book clubs. They generalize to:
* Film clubs (watch parties, voting on next film)
* Music listening clubs (album of the month)
* Podcast clubs, wine clubs, game night groups
* Any recurring community that selects, experiences, and reflects together

## What Would Change for Multi-Club

**Data model:** A `Club` or `Organization` entity would become the top-level scope. Meetings, books, nominations, votes, reviews, and users would all gain a `club_id` foreign key. The current flat namespace works for one club but would need scoping.

**Brand identity:** "First Edition" as a design system can generalize. The SF club's specific identity (name, tagline, amber/teal accents) would become per-club customization. The platform would need its own brand distinct from any single club.

**Hosting and infrastructure:** SQLite on a single Fly.io volume works for one club. Multi-tenant would require a managed database (Postgres), multi-tenant routing, and scoped authentication.

**Authentication:** Magic links currently create users in a flat namespace. Multi-club would need club-scoped membership and potentially cross-club identity.

## Decisions to Make Later (Not Now)

* Platform name (it cannot stay "SF Fantasy & Sci-Fi Book Club App")
* Pricing model (free tier? per-club subscription? supporter features?)
* Self-serve club creation vs. curated onboarding
* What is customizable per club vs. what is platform-level

## What to Protect in v1

Make these architectural choices now to avoid painful migrations later:

* **Keep the meeting state model clean.** It generalizes perfectly — do not add club-specific logic to state transitions.
* **Use the canonical component system.** Components like BookHero, BookCard, and ReviewCard are reusable across any club.
* **Keep the data model boundaries sharp.** Book is canonical and reusable. Meeting is contextual. Do not merge them.
* **Do not hardcode the club name or identity into templates.** Use configuration or environment variables for club name, tagline, and external links (Meetup URL, etc.).
* **Keep the "First Edition" design system in its own token layer.** Future clubs could use different themes by swapping tokens, not rewriting components.

---
