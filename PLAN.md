# SF Fantasy & Sci-Fi Book Club App — Implementation Plan

**Date:** February 14, 2026
**Domain:** bookclub.designbyjohnwayne.com
**Hosting:** Fly.io (paid tier)
**Email:** DreamHost SMTP

---

## Table of Contents

1. [Technical Decisions](#1-technical-decisions)
2. [Project Structure](#2-project-structure)
3. [Implementation Phases](#3-implementation-phases)
4. [Phase 0: Foundation](#phase-0-foundation)
5. [Phase 1: Data Layer & Admin Bootstrap](#phase-1-data-layer--admin-bootstrap)
6. [Phase 2: Public Pages (Home, History, Book Detail)](#phase-2-public-pages)
7. [Phase 3: Nomination Flow](#phase-3-nomination-flow)
8. [Phase 4: Voting & Live Results](#phase-4-voting--live-results)
9. [Phase 5: Authentication & Reviews](#phase-5-authentication--reviews)
10. [Phase 6: Admin Dashboard](#phase-6-admin-dashboard)
11. [Phase 7: Historical Data Seeding](#phase-7-historical-data-seeding)
12. [Phase 8: PWA, Polish & Deploy](#phase-8-pwa-polish--deploy)
13. [Historical Meetup Data](#historical-meetup-data)
14. [Risk Log](#risk-log)

---

## 1. Technical Decisions

### Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20 LTS | Stable, well-supported on Fly.io |
| Framework | Express.js | Lightweight, full control over routing |
| Template Engine | EJS | HTML-like syntax, easy manual editing |
| Database | SQLite via better-sqlite3 | Single-file, no external DB service, fast reads |
| Migrations | Custom migration runner | Simple numbered SQL files, no ORM overhead |
| Session | express-session + connect-better-sqlite3 | Cookie-based sessions stored in SQLite, 30-day member sessions |
| Email | Nodemailer + DreamHost SMTP | Magic links, admin alerts |
| Real-time | Server-Sent Events (SSE) | Native browser support, simple server-side |
| Book Metadata | Open Library (primary) → Google Books (fallback) | Open Library is free/reliable; Google Books as backup |
| CSS | Vanilla CSS with custom properties | Matches design tokens directly, no build step needed |
| JS (client) | Vanilla JS with progressive enhancement | No framework overhead, fast QR entry loads |
| Deployment | Fly.io (paid tier) | Persistent volume for SQLite, long-lived SSE connections |
| Domain | bookclub.designbyjohnwayne.com | Via Fly.io custom domain + TLS |

### Key Architecture Decisions

1. **Server-rendered first** — Every page works without JavaScript. JS enhances (drag-to-reorder, SSE, optimistic UI).
2. **No build step for CSS/JS** — Static files served directly. Keeps the project simple and editable.
3. **SQLite on persistent volume** — Fly.io volumes persist across deploys. Daily backup to DreamHost via SCP/rsync.
4. **Fingerprint-based duplicate prevention** — Cookie-stored `client_id` hashed with server secret + meeting ID.
5. **Admin is a separate shell** — `/admin/*` routes use `AdminShell` layout, not discoverable from public nav.

---

## 2. Project Structure

```
sf-book-club/
├── .env.example                  # Environment template
├── .gitignore
├── fly.toml                      # Fly.io config
├── package.json
├── server.js                     # Entry point
├── PLAN.md                       # This file
│
├── config/
│   └── index.js                  # Env config loader
│
├── db/
│   ├── index.js                  # Database connection + helpers
│   ├── migrate.js                # Migration runner
│   └── migrations/
│       ├── 001-initial-schema.sql
│       ├── 002-seed-grade-weights.sql
│       └── ...
│
├── routes/
│   ├── public.js                 # Home, History, Book Detail
│   ├── nominate.js               # Nomination flow
│   ├── vote.js                   # Voting flow
│   ├── results.js                # Results + SSE
│   ├── auth.js                   # Magic link login/callback
│   ├── reviews.js                # Review CRUD
│   ├── admin.js                  # Admin pages + API
│   └── api.js                    # JSON API endpoints
│
├── services/
│   ├── books.js                  # Open Library / Google Books lookup
│   ├── email.js                  # Nodemailer / magic link sender
│   ├── voting.js                 # Points calculation, ranking
│   ├── fingerprint.js            # Client identity hashing
│   └── slug.js                   # Slug generation utility
│
├── middleware/
│   ├── auth.js                   # Session checks, admin guard
│   ├── meeting-state.js          # Inject current meeting state
│   └── rate-limit.js             # Basic IP rate limiting
│
├── views/
│   ├── layouts/
│   │   ├── app-shell.ejs         # Public layout (header/footer)
│   │   ├── admin-shell.ejs       # Admin layout
│   │   └── focus-shell.ejs       # Minimal layout (nominate/vote)
│   ├── partials/
│   │   ├── global-nav.ejs
│   │   ├── book-hero.ejs
│   │   ├── book-card.ejs
│   │   ├── book-cover.ejs
│   │   ├── banner.ejs
│   │   ├── metadata-list.ejs
│   │   ├── review-card.ejs
│   │   ├── results-chart.ejs
│   │   ├── grade-picker.ejs
│   │   ├── status-pill.ejs
│   │   ├── toast.ejs
│   │   ├── empty-state.ejs
│   │   ├── vote-counter.ejs
│   │   └── qr-panel.ejs
│   ├── home.ejs
│   ├── history.ejs
│   ├── book-detail.ejs
│   ├── nominate.ejs
│   ├── vote.ejs
│   ├── results.ejs
│   ├── review.ejs
│   ├── my-reviews.ejs
│   ├── login.ejs
│   ├── auth-callback.ejs
│   └── admin/
│       ├── overview.ejs
│       ├── nominations.ejs
│       ├── results.ejs
│       ├── settings.ejs
│       └── seed.ejs
│
├── public/
│   ├── css/
│   │   ├── tokens.css            # Design tokens (CSS custom properties)
│   │   ├── base.css              # Reset, typography, global styles
│   │   ├── components.css        # All canonical component styles
│   │   └── pages.css             # Page-specific overrides
│   ├── js/
│   │   ├── drag-reorder.js       # Touch drag for ballot
│   │   ├── sse-results.js        # Live results client
│   │   ├── nominate-form.js      # Auto-fetch metadata, offline retry
│   │   ├── grade-picker.js       # Grade selector interaction
│   │   └── sw.js                 # Service worker (PWA)
│   ├── fonts/                    # Self-hosted Fraunces, Source Serif 4, IBM Plex Sans
│   ├── manifest.json             # PWA manifest
│   └── img/
│       └── placeholder-cover.svg # Fallback book cover
│
├── scripts/
│   ├── seed-history.js           # Seed historical meetings from JSON
│   ├── export-markdown.js        # Generate markdown snapshots
│   └── backup-db.sh              # Cron-able backup script
│
└── data/
    └── historical-meetings.json  # Meetup data for seeding
```

---

## 3. Implementation Phases

### Overview

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 0 | Foundation | Project scaffold, config, dev server, design tokens, base styles |
| 1 | Data Layer | SQLite schema, migrations, DB helpers, admin bootstrap |
| 2 | Public Pages | Home, History, Book Detail with real data |
| 3 | Nominations | QR entry, nomination form, metadata auto-fetch |
| 4 | Voting & Results | Ranked ballot, points calculation, SSE live results |
| 5 | Auth & Reviews | Magic links, review submission, My Reviews |
| 6 | Admin Dashboard | Meeting controls, QR panel, nominations management |
| 7 | Data Seeding | Historical Meetup data import, Open Library enrichment |
| 8 | PWA, Polish & Deploy | Service worker, offline retry, Fly.io deploy, domain setup |

---

## Phase 0: Foundation

**Goal:** Runnable project with design system in place before any feature code.

### Steps

1. **Initialize project**
   - `npm init`, install Express, EJS, better-sqlite3, dotenv, nodemailer, express-session
   - Create `.env.example` with all required vars
   - Create `.gitignore` (node_modules, .env, *.sqlite)

2. **Server setup (`server.js`)**
   - Express app with EJS view engine
   - Static file serving from `/public`
   - Session middleware
   - Error handling middleware
   - Dev: port 3000

3. **Design tokens (`public/css/tokens.css`)**
   - All CSS custom properties from Design-Specs.md §6
   - Font imports (self-hosted Fraunces, Source Serif 4, IBM Plex Sans)
   - Color tokens, spacing scale, radius, shadows, max-width

4. **Base styles (`public/css/base.css`)**
   - CSS reset (modern, minimal)
   - Typography hierarchy (Display, Section, Body, Meta)
   - Global element styles (links, buttons base, focus states)
   - Utility classes (visually-hidden, sr-only)

5. **Layouts**
   - `app-shell.ejs` — Public layout with GlobalNav, constrained content column
   - `focus-shell.ejs` — Minimal header for nominate/vote flows
   - `admin-shell.ejs` — Admin nav layout (separate from public)
   - `global-nav.ejs` — Home, History, My Reviews links (quiet, Level 3 gravity)

6. **Placeholder pages**
   - Render "Coming soon" for all routes to verify routing works
   - Use the frontend-design skill for all visual work

### Acceptance
- `npm start` runs the dev server
- All routes return rendered HTML with correct layout shells
- Design tokens applied — correct fonts, colors, spacing visible
- Mobile-responsive base layout works

---

## Phase 1: Data Layer & Admin Bootstrap

**Goal:** Database schema, migration system, and first admin account.

### Steps

1. **Migration runner (`db/migrate.js`)**
   - Reads numbered `.sql` files from `db/migrations/`
   - Tracks applied migrations in a `_migrations` table
   - Runs on server start (idempotent)

2. **Initial schema (`001-initial-schema.sql`)**
   - Tables: `meetings`, `books`, `meeting_nominees`, `nominations`, `votes`, `reviews`, `users`, `magic_link_tokens`
   - Indexes on foreign keys and lookup fields
   - Grade weight mapping as a reference table or app constant

3. **Database helpers (`db/index.js`)**
   - Connection singleton
   - Common queries as prepared statements
   - Transaction helper

4. **Admin bootstrap**
   - Environment variable `BOOTSTRAP_KEY`
   - One-time route `POST /api/admin/bootstrap` accepts key + email + password
   - Creates first admin user, then bootstrap key becomes invalid
   - Subsequent admins added through admin settings

5. **Admin auth middleware**
   - `POST /admin/login` with email + password (bcrypt hashed)
   - Session-based admin auth
   - `requireAdmin` middleware for all `/admin/*` routes

### Acceptance
- Database auto-creates on first run with all tables
- Bootstrap key creates first admin
- Admin can log in to `/admin`

---

## Phase 2: Public Pages

**Goal:** Home, History, and Book Detail pages rendering real data with editorial design.

### Steps

1. **Home page (`GET /`)**
   - Query: current meeting (by state), current book (winning_book_id), next 3-6 books from history
   - Components: BookHero (current book), Banner (dynamic CTA based on meeting state), MetadataList (next meeting info), BookCard strip (recent history)
   - Use frontend-design skill for implementation

2. **History page (`GET /history`)**
   - Query: all meetings with winning books, ordered by date DESC
   - Components: BookCard grid (responsive 2→3→4-6 columns), EmptyState fallback
   - Book covers via Open Library cover API

3. **Book Detail page (`GET /books/:bookId/:slug?`)**
   - Query: book + meeting context + reviews (anonymous) + average grade
   - Slug redirect logic (301 if slug doesn't match, 302 if missing)
   - Components: BookHero, MetadataList (external links), review summary (average grade + distribution), ReviewList
   - Grade distribution visualization

4. **Component styles (`public/css/components.css`)**
   - All 28 canonical components styled per design tokens
   - BookCover with 2:3 aspect ratio + placeholder fallback
   - Card, Banner, StatusPill, MetadataList, ReviewCard

5. **Book cover strategy**
   - Primary: Open Library Covers API (`covers.openlibrary.org/b/isbn/{isbn}-L.jpg`)
   - Fallback: Store `cover_url` in DB from initial metadata fetch
   - Last resort: SVG placeholder with title/author initials

### Acceptance
- Home shows current book hero, meeting info, recent history strip
- History shows responsive grid of all past books
- Book Detail shows artifact-quality page with cover, metadata, reviews
- All pages pass accessibility audit (contrast, tap targets, heading hierarchy)

---

## Phase 3: Nomination Flow

**Goal:** QR → form → submit → confirmation in under 10 seconds.

### Steps

1. **Nomination page (`GET /nominate/:meetingId`)**
   - Meeting state guard: if not `nominations`, redirect to appropriate page
   - Focus-mode layout (focus-shell.ejs)
   - Form: title input (autofocus), author input, submit button
   - Enter key submits, minimal validation

2. **Nomination API (`POST /api/meetings/:meetingId/nominations`)**
   - Fingerprint check: generate `client_id` cookie if missing, hash with server secret + meetingId
   - Duplicate check: if fingerprint exists, return edit flow
   - Create or find Book record (title + author lookup)
   - Create Nomination record
   - Return success with book metadata

3. **Metadata auto-fetch (`services/books.js`)**
   - On nomination submit, async fetch from Open Library Search API
   - Match by title + author → retrieve cover URL, ISBN, page count, publication year
   - Fallback to Google Books API if Open Library returns no results
   - Store enriched data on Book record
   - Client-side: show cover preview after submit (progressive enhancement)

4. **Fingerprint service (`services/fingerprint.js`)**
   - Generate UUID `client_id`, store in cookie (httpOnly, 1 year expiry)
   - Hash: `SHA256(client_id + SERVER_SECRET + meetingId)`
   - Store hash as `submitted_fingerprint` on nomination/vote

5. **Client JS (`public/js/nominate-form.js`)**
   - Offline detection + local draft storage
   - Auto-retry on reconnect
   - Fetch metadata preview after submission
   - Toast feedback for success/error/duplicate

### Acceptance
- QR code URL → nomination form loads in <2 seconds
- Submit → confirmation in <10 seconds total flow
- Duplicate nomination shows "already nominated" with edit option
- Works without JavaScript (form submits normally)

---

## Phase 4: Voting & Live Results

**Goal:** Ranked ballot with drag-to-reorder, live updating results via SSE.

### Steps

1. **Vote page (`GET /vote/:meetingId`)**
   - Meeting state guard: if not `voting`, redirect
   - Focus-mode layout
   - Query: all nominees for this meeting with book metadata
   - Randomize order per user (seeded by client_id)
   - Render NomineeRow for each (cover, title, author, page count, external link)
   - Submit button + vote counter

2. **Drag-to-reorder (`public/js/drag-reorder.js`)**
   - Touch-based drag (mobile first)
   - Visual: elevated item with shadow, smooth reorder animation
   - Tap-to-rank fallback: number input or tap-to-move-up
   - Respect `prefers-reduced-motion`

3. **Vote API (`POST /api/meetings/:meetingId/votes`)**
   - Fingerprint duplicate check
   - Store `ranking_json` (ordered array of book IDs)
   - Calculate points: top rank = N points (N = number of nominees), descending
   - Trigger SSE broadcast of updated results

4. **Live Results page (`GET /results/:meetingId`)**
   - Vertical bar chart (CSS-based, no charting library)
   - Each nominee: colored bar (accessible palette, deterministic assignment), cover thumbnail, points
   - Ranked list below chart
   - VoteCounter + StatusPill (open/closed)
   - Winner callout (shown only when voting closed)

5. **SSE endpoint (`GET /api/meetings/:meetingId/results`)**
   - Stream: `event: results`, `data: { rankings, voteCount, status }`
   - Broadcast to all connected clients on each new vote
   - Client reconnection handling

6. **Client JS (`public/js/sse-results.js`)**
   - Connect to SSE endpoint
   - Animate bar height changes (smooth CSS transitions)
   - Animate vote counter increment
   - Handle connection lost → reconnecting indicator
   - Handle voting closed → winner emphasis

### Acceptance
- Ballot loads with randomized order, drag works on mobile
- Each vote triggers real-time update on results page for all viewers
- 10+ concurrent users can vote without performance issues
- Results page shows winner after voting closes
- Works without JS (form POST submits ranking, static results page)

---

## Phase 5: Authentication & Reviews

**Goal:** Magic link login, review submission, and personal review history.

### Steps

1. **Login page (`GET /login`)**
   - Email input form
   - "Enter your email to receive a login link"
   - Rate limit: max 3 magic links per email per hour

2. **Magic link sender (`POST /api/auth/magic-link`)**
   - Generate secure random token (crypto.randomBytes)
   - Store in `magic_link_tokens` with 15-min expiry
   - Send email via DreamHost SMTP (Nodemailer)
   - Email template: simple, branded, single CTA button

3. **Auth callback (`GET /auth/callback?token=...`)**
   - Validate token (not expired, not used)
   - Mark token as used
   - Find or create User by email
   - Set session with 30-day expiry ("Remember this device")
   - Redirect to intended destination or home

4. **Review page (`GET /books/:bookId/review`)**
   - Auth required (AuthGate)
   - Query: existing review by this user for this book (for edit)
   - GradePicker component (S through F-)
   - Markdown comment textarea
   - Submit button

5. **Review API**
   - `POST /api/reviews` — Create review (grade + optional markdown body)
   - `PATCH /api/reviews/:reviewId` — Update own review
   - Validate: one review per user per book

6. **My Reviews page (`GET /my-reviews`)**
   - Auth required
   - Query: all reviews by current user with book metadata
   - ReviewList with edit links
   - Grade summary (personal average, count)

7. **Authenticated view enhancements**
   - Book Detail: show reviewer display names when logged in
   - Book Detail: show "Edit my review" button if user has reviewed

### Acceptance
- Magic link email arrives within 30 seconds
- Token expires after 15 minutes, single-use
- Review submission works with grade only (comment optional)
- My Reviews shows personal history
- Logged-in users see reviewer names on Book Detail

---

## Phase 6: Admin Dashboard

**Goal:** Full meeting lifecycle control from a phone.

### Steps

1. **Admin Overview (`GET /admin`)**
   - Current meeting state + status pill
   - Quick action buttons (context-dependent):
     - Reading → "Open Nominations"
     - Nominations → "Close Nominations" / "Open Voting"
     - Voting → "Close Voting"
     - Results → "Archive Meeting" / "Create Next Meeting"
   - Live counts: nominations count, vote count
   - QR panel for current meeting

2. **Admin Nominations (`GET /admin/nominations`)**
   - List all nominations for current meeting
   - CRUD: edit nomination (fix typo), remove nomination
   - Add nomination manually (admin override)
   - Nomination count

3. **Admin Results (`GET /admin/results`)**
   - Leaderboard view (same as public results but with admin controls)
   - Export as markdown
   - Backup database trigger

4. **Admin Settings (`GET /admin/settings`)**
   - Manage admin accounts (add/remove)
   - Meeting configuration (next meeting details, Meetup URL)
   - Operational: trigger markdown export, download DB backup

5. **Meeting state transitions (`POST /api/admin/meetings/:meetingId/state`)**
   - Preflight checks before each transition:
     - Opening voting: at least 2 nominations exist
     - Closing voting: at least 1 vote cast
   - Confirmation for destructive actions
   - Timestamps recorded (nominations_open_at, etc.)

6. **QR Panel (`partials/qr-panel.ejs`)**
   - Server-generated QR codes (use `qrcode` npm package)
   - Short URLs: `/nominate/:meetingId`, `/vote/:meetingId`, `/results/:meetingId`
   - Printable layout option

7. **Create meeting flow**
   - Admin creates a meeting: select month/year, enter meeting time, location, Meetup URL
   - Optionally set current book (winning_book_id from previous meeting's vote)

### Acceptance
- Admin can run full meeting lifecycle from phone
- State transitions have preflight checks
- QR codes display correctly and scan to proper URLs
- Meeting creation works

---

## Phase 7: Historical Data Seeding

**Goal:** Import past 32 meetings from Meetup data.

### Strategy

Build a seeding script (`scripts/seed-history.js`) that:

1. Reads `data/historical-meetings.json` (structured Meetup data)
2. For each meeting:
   - Parses book title from event name ("Book Title @ Venue" format)
   - Creates Book record
   - Fetches metadata from Open Library (cover, ISBN, page count, year)
   - Creates Meeting record with `status: 'results'`, date, location, Meetup URL
   - Sets `winning_book_id`
3. Handles the 22 meetings I couldn't scrape — you'll add those manually to the JSON file, or we can use the Chrome browser tool to scrape them during implementation

### Data I've Already Collected (10 of 32)

See [Historical Meetup Data](#historical-meetup-data) section below.

### Remaining 22 Events

Options:
- **Option A:** You log into Meetup and provide the full list (or screenshot)
- **Option B:** During implementation, I use the browser automation tools to scrape while you're logged in
- **Option C:** You manually add them to `historical-meetings.json`

### Acceptance
- All 32 historical meetings appear in the History page
- Each book has a cover image from Open Library
- Dates, venues, and Meetup URLs are accurate

---

## Phase 8: PWA, Polish & Deploy

**Goal:** Production-ready deployment.

### Steps

1. **PWA manifest (`public/manifest.json`)**
   - App name, icons (designed later), theme color
   - `display: standalone`
   - Start URL: `/`

2. **Service worker (`public/js/sw.js`)**
   - Cache static assets (CSS, fonts, JS, placeholder images)
   - Cache UI shell for offline display
   - Nomination/vote: store draft locally on network failure, retry on reconnect

3. **App icon design**
   - Simple, recognizable mark that works at small sizes
   - Aligned with First Edition aesthetic
   - Generate all required PWA icon sizes

4. **Performance polish**
   - Font loading strategy (`font-display: swap`, preload critical fonts)
   - Image lazy loading for history grid
   - Compress static assets
   - SQLite WAL mode for concurrent reads

5. **Fly.io deployment**
   - `fly.toml` configuration
   - Persistent volume for SQLite database
   - Custom domain: `bookclub.designbyjohnwayne.com`
   - TLS certificate (auto via Fly.io)
   - Health check endpoint

6. **Backup strategy**
   - Scheduled Fly.io machine to SCP the SQLite file to DreamHost daily
   - Or: Litestream for continuous SQLite replication

7. **Markdown exports**
   - Admin-triggered export of history pages as `.md` files
   - Optional: push to DreamHost for static hosting

### Acceptance
- App installs to home screen on mobile
- Offline nomination draft saves and retries
- Deployed to Fly.io with custom domain + TLS
- Database backups running

---

## Historical Meetup Data

### Collected (10 most recent past events)

| # | Book | Date | Venue | Attendees |
|---|------|------|-------|-----------|
| 1 | The Long Way to a Small, Angry Planet | Jan 28, 2026 | Southern Pacific Brewing | 22 |
| 2 | The Spear Cuts Through Water | Dec 17, 2025 | Caffe Greco | 19 |
| 3 | Victories Greater Than Death | Nov 19, 2025 | Woods Lowside | 23 |
| 4 | A Deadly Education | Oct 22, 2025 | Barebottle Brewing | 19 |
| 5 | Children of Time | Sep 24, 2025 | Southern Pacific Brewing | 24 |
| 6 | Red Rising | Aug 20, 2025 | Woods Lowside | 20 |
| 7 | Red Rising (supplemental) | Aug 30, 2025 | Southern Pacific Brewing | 19 |
| 8 | Dawn | Jul 30, 2025 | Barebottle Brewing | 23 |
| 9 | Gideon the Ninth | Jun 25, 2025 | Southern Pacific Brewing | 21 |
| 10 | The Murderbot Diaries 1-4 | May 28, 2025 | Woods Lowside | 19 |

### Upcoming (for initial meeting creation)

| Book | Date | Venue | Attendees |
|------|------|-------|-----------|
| Ubik (Philip K. Dick) | Feb 25, 2026 | Barebottle Brewing | 25 |
| Never Let Me Go (Kazuo Ishiguro) | Mar 25, 2026 | Woods Lowside | 25 |
| Mistborn (Brandon Sanderson) | Apr 29, 2026 | Caffe Greco | 14 |

### Missing (~22 events, May 2024 – Apr 2025)

These need to be provided via one of the methods described in Phase 7.

---

## Risk Log

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DreamHost SMTP deliverability delays | Medium | Medium | Set reasonable expectations in UI ("check spam"), add resend flow |
| SSE connections dropped on mobile | Medium | Low | Auto-reconnect with exponential backoff, fallback to polling |
| SQLite concurrent writes during live voting | Low | Medium | WAL mode, write serialization via better-sqlite3 (synchronous) |
| Open Library API rate limits | Low | Low | Cache aggressively, batch enrichment during seeding |
| Fly.io volume data loss | Very Low | High | Daily backups + Litestream replication |
| QR code scanning issues in dim venues | Low | Low | Provide short URL alongside QR on admin page |

---

## Design Implementation Notes

Every frontend page will be built using the **frontend-design skill** to ensure high visual quality aligned with the First Edition aesthetic (record.club-inspired). Key principles to follow:

- **Fonts:** DM Serif Display (section headings, brand), Fraunces 700 (hero book title only), Source Serif 4 italic (author names, reviews), Inter (body, metadata, nav, buttons), IBM Plex Sans (badges, dates), Source Sans 3 (secondary body, links) — no substitutions
- **Colors:** Pure white `#FFFFFF` background, black `#000000` text, gray `#666666`/`#999999` metadata, gold `#F5A623` star ratings, amber `#b45309` detail links, teal `#0f766e` status dots, black pill CTAs
- **Layout:** Single centered column (max 860px), generous whitespace between sections, dense within components
- **Book covers** provide ALL visual color and energy — the UI stays neutral with near-zero color
- **No texture, grain, or noise** — pure white canvas only
- **Motion:** 150-220ms transitions, calm editorial motion, respect `prefers-reduced-motion`
- **Mobile-first:** 44px minimum tap targets, 2-column book grids on mobile
- **Accessibility:** High contrast against white backgrounds, semantic HTML, proper heading hierarchy, ARIA labels

---

## Next Steps

After plan approval:
1. Start with Phase 0 — project scaffold + design system
2. Build each phase sequentially, testing as we go
3. Use the frontend-design skill for every page/component build
4. Validate visually after each page is complete

---

*End of Plan*
