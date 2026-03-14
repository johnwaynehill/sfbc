# GatherBound - Architecture & Technology Stack

A technical reference for the core architecture, data flow, and technology decisions powering GatherBound (SF Fantasy & Sci-Fi Book Club).

Read this alongside:
- **Tech-Specs.md** - data model and API contracts
- **Design-Specs.md** - visual system, tokens, components
- **PRD.md** - product specification, user stories, page definitions
- **ROADMAP.md** - milestone planning
- **SHIPPED.md** - release history

---

## 1. Stack Overview

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20 | LTS stability, native `fetch`, `--watch` for dev |
| Framework | Express 5 | Async error handling, modern routing |
| Templates | EJS + express-ejs-layouts | Server-rendered HTML, layout inheritance |
| Database | SQLite via better-sqlite3 | Zero-config, single-file, synchronous API |
| Sessions | express-session + SQLite store | Sessions live in the same DB, no Redis needed |
| Auth | Magic links (primary) + password (secondary) | Passwordless-first, fallback for admins |
| Deployment | Fly.io (sjc region) | Single-machine SQLite hosting, persistent volumes |
| CSS | Custom design tokens + components | No framework; three-file architecture |
| Client JS | Vanilla ES5/ES6 | No build step, no bundler, progressive enhancement |

**Zero build-step philosophy.** There is no Webpack, Vite, or TypeScript compiler. CSS and JS are authored directly and served as static files. Cache busting uses query-string versioning (`?v=N`).

---

## 2. Project Structure

```
SF-Book-Club-v3/
  server.js              # Express app entry point
  config/index.js        # Environment-based configuration
  package.json           # Dependencies and npm scripts

  db/
    index.js             # Database connection (better-sqlite3)
    migrate.js           # Migration runner + post-migration hooks
    migrations/          # 001-019 numbered SQL files

  routes/
    public.js            # Public pages (home, books, history, members)
    auth.js              # Login, logout, magic links, password auth
    admin.js             # Admin dashboard (mounted at /admin)
    api.js               # REST API endpoints (mounted at /api)
    nominate.js          # Nomination form
    nominations.js       # Nominations listing
    vote.js              # Voting UI
    results.js           # Vote results
    reviews.js           # Review listing and detail

  services/
    monthly-picks.js     # Pick lifecycle state machine
    books.js             # Google Books API, cover downloads
    meetings.js          # Meeting CRUD, QR codes
    voting.js            # Vote submission, seeded shuffle, tallying
    reviews.js           # Review CRUD, grade processing
    replies.js           # Review reply management
    reactions.js         # Emoji reactions
    announcements.js     # Club announcements
    activity.js          # Activity feed queries
    email.js             # Nodemailer integration
    fingerprint.js       # Device fingerprinting for voting

  middleware/
    auth.js              # requireMember, requireAdmin
    validate.js          # express-validator chains

  utils/
    format.js            # Date/time formatting helpers
    slug.js              # URL slug generation
    markdown.js          # Markdown rendering + spoiler syntax
    colorHash.js         # Deterministic color from string
    gradeGradient.js     # Grade-to-gradient visualization
    resolve-month.js     # Month parsing

  views/
    layouts/             # 3 shell layouts (app, admin, focus)
    partials/            # Reusable components (avatar, nav, pagination)
    admin/               # Admin pages
    *.ejs                # Public and member pages

  public/
    css/                 # tokens.css, base.css, components.css
    js/                  # 22 vanilla JS files (no bundler)
    img/                 # Logos, covers, icons
    fonts/               # Self-hosted fonts

  scripts/               # CLI helpers (seed, fetch covers, etc.)
  docs/                  # This directory
```

---

## 3. Application Bootstrap

`server.js` initializes the app in this order:

1. **Database + migrations** - Opens SQLite, runs pending `.sql` files, applies post-migration hooks (slug backfill, pick seeding, lifecycle sync)
2. **Security** - Helmet CSP, rate limiting (300 req/15 min)
3. **View engine** - EJS with `app-shell` as default layout
4. **Compression** - gzip, with SSE streams excluded
5. **Static files** - `/public` with 7-day cache in production
6. **Sessions** - SQLite-backed store, 30-day cookies, expired session cleanup every 15 minutes
7. **User injection** - Middleware that loads the current user into `res.locals.user` on every request
8. **Global template locals** - Format functions, club config, and utilities available in every template
9. **Routes** - Public, auth, admin, API (in that order)
10. **Error handlers** - 404 page and 500 catch-all

---

## 4. Database

### Connection

```
better-sqlite3 → SQLite file on disk
  journal_mode = WAL      (concurrent reads during writes)
  foreign_keys = ON       (referential integrity enforced)
  busy_timeout = 5000     (wait 5s on lock contention)
```

In production the database lives on a persistent Fly.io volume at `/data/bookclub.sqlite`. In development it's at `./data/bookclub.sqlite`.

### Migration System

Migrations are numbered SQL files (`001-initial-schema.sql` through `019-invites.sql`) in `db/migrations/`. The runner:

- Creates a `_migrations` tracking table if it doesn't exist
- Applies any `.sql` file not yet in the tracking table, in sorted order
- Temporarily disables foreign keys during migration transactions (prevents CASCADE issues when restructuring tables)
- Re-enables foreign keys and runs `PRAGMA foreign_key_check` after each migration
- Runs idempotent post-migration hooks: `seedUserSlugs()`, `seedMonthlyPicks()`, `seedPicksLifecycle()`

All migrations run automatically on server start. No manual migration commands are needed.

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Members and admins (email, password hash, display name, role, avatar style, social links, slug) |
| `books` | Canonical book records (title, author, cover, ISBN, description, publisher, language, slugs) |
| `meetings` | Monthly club contexts (month/year, status, winning book, scheduling data) |
| `monthly_picks` | Current and historical picks with full lifecycle timestamps |
| `events` | Meeting event sessions (time, location, Meetup link) — decoupled from meetings |
| `nominations` | Proposed books per meeting |
| `votes` | Member votes on nominees |
| `reviews` | Book reviews (grade, body, spoiler flag, did-finish flag) |
| `review_replies` | Threaded comments on reviews |
| `emoji_reactions` | Emoji reactions to reviews |
| `grade_weights` | Letter grade to numeric weight mapping (F=0.0 through S=4.3) |
| `magic_link_tokens` | Passwordless auth tokens (15-minute TTL) |
| `announcements` | Club announcements |
| `invites` | Shareable invite codes with usage tracking |
| `_migrations` | Applied migration tracking |

### Query Patterns

All queries use **prepared statements** via `db.prepare()`. Multi-step operations use `db.transaction()` for atomicity. There is no ORM — SQL is written directly. The synchronous API of better-sqlite3 eliminates callback/promise complexity in route handlers.

---

## 5. Authentication

### Dual-Mode Auth

**Magic links** are the primary auth flow for members:
1. User enters email → server generates a 32-byte crypto token
2. Token stored in `magic_link_tokens` with 15-minute expiry
3. Email sent via Nodemailer (SMTP) with callback link
4. `GET /auth/callback?token=xxx` validates the token, creates a session
5. First-time users are auto-registered (display name extracted from email prefix)

**Password login** is the secondary flow, mainly for admins:
1. User enters email + password → validated against bcryptjs hash (cost factor 12)
2. New member accounts can self-register with a password via `POST /auth/password-login`

**Admin bootstrap** uses a one-time `BOOTSTRAP_KEY` environment variable to create the first admin account. After that, admins create other admins through the dashboard.

### Session Management

- **Store:** SQLite via `better-sqlite3-session-store`
- **Cookie:** httpOnly, sameSite `lax`, secure in production, 30-day max age
- **Proxy trust:** `app.set('trust proxy', 1)` required for Fly.io's HTTPS termination
- **Cleanup:** Expired sessions cleared every 15 minutes automatically

### Authorization Middleware

Two gate functions in `middleware/auth.js`:

- **`requireMember`** - Validates session, loads user from DB into `req.user`, redirects unauthenticated users to `/login` (stores `returnTo` for post-login redirect)
- **`requireAdmin`** - Same as above plus `role === 'admin'` check, enriches `req.user.isSuperAdmin` from env var, redirects to `/admin/login`

### Rate Limiting

- Global: 300 requests per 15 minutes per IP
- Auth endpoints: 5 attempts per 15 minutes per IP (separate limiter in `routes/auth.js`)
- Form submissions: 10 per 15 minutes per IP

---

## 6. Routing Architecture

Routes are organized by concern, mounted in `server.js`:

```
/              → routes/public.js     (home, books, history, members, changelog)
/              → routes/nominate.js   (nomination form)
/              → routes/nominations.js (nomination listing)
/              → routes/vote.js       (voting UI)
/              → routes/results.js    (vote results)
/              → routes/auth.js       (login, logout, magic links)
/              → routes/reviews.js    (review listing and detail)
/admin         → routes/admin.js      (admin dashboard pages)
/api           → routes/api.js        (REST API for all AJAX operations)
```

**Pattern:** Routes are thin controllers. They validate input (via `middleware/validate.js` chains), call service functions for business logic, and render templates or return JSON. No business logic lives in route files.

### API Layer

`routes/api.js` is the largest route file, serving all client-side AJAX calls. Endpoints follow REST conventions:

- **Auth:** `/api/auth/*` (login, logout, profile updates, slug checks)
- **Admin:** `/api/admin/*` (user management, pick management, book covers, events)
- **Member:** `/api/invites/*` (invite link generation)
- **Public:** `/api/books/search-multi`, `/api/health`

All admin endpoints are gated by `requireAdmin`. Member endpoints use `requireMember`. Both return JSON with `{ success, ...data }` or `{ error }` responses.

---

## 7. Services Layer

Services contain all business logic and database queries. They export plain functions (not classes) and receive the `db` instance via module-level import.

### Key Services

**monthly-picks.js** (largest service) — Manages the pick lifecycle state machine:
- States: `scheduled` → `nominations` → `voting` → `reading` → `results`
- Each transition updates lifecycle timestamps (`nominations_open_at`, `voting_open_at`, etc.)
- `getHero()` powers the home page with the current active pick
- `getEvents()`, `createEvent()`, `updateEvent()`, `deleteEvent()` manage meeting sessions

**books.js** — Google Books API integration:
- `searchGoogleBooksMulti(query)` — Searches by title/author, returns candidates
- `findOrCreateBook(data)` — Upserts a book record with slug generation
- `enrichBookMetadata(bookId)` — Fills in ISBN, page count, publisher, language
- `downloadCover(imageUrl, filename)` — Downloads cover images, rejects placeholders under 15KB

**voting.js** — Vote tallying with seeded shuffle for ballot randomization to eliminate position bias.

---

## 8. View Architecture

### Layouts (Shells)

Three EJS layouts provide the HTML skeleton for different contexts:

| Layout | Used For |
|--------|----------|
| `app-shell.ejs` | All public and member pages (nav, footer, theme toggle) |
| `admin-shell.ejs` | Admin dashboard pages (admin nav, admin footer) |
| `focus-shell.ejs` | Single-focus views like login, onboarding |

Each shell includes the three CSS files with cache-bust query strings and loads Google Fonts.

### Template Patterns

- **Partials** (`views/partials/`) — Reusable includes: `avatar`, `global-nav`, `pagination`, `meeting-details-bar`, `placeholder-cover`, `qr-panel`
- **Template locals** — Every template has access to `user`, `club`, `currentPath`, and format helpers via middleware injection
- **Conditional rendering** — Auth state drives UI: logged-in users see review forms, reactions, and member-only sections

### Cache Busting

CSS links in all three shells use `?v=N` query strings:
```html
<link rel="stylesheet" href="/css/tokens.css?v=16">
<link rel="stylesheet" href="/css/base.css?v=17">
<link rel="stylesheet" href="/css/components.css?v=48">
```
Bump the version in all three shells whenever CSS changes.

---

## 9. CSS Architecture

### Three-File Split

| File | Size | Purpose |
|------|------|---------|
| `tokens.css` | ~4 KB | Design tokens: colors, spacing (8pt grid), type scale, font stacks, radii, shadows |
| `base.css` | ~15 KB | Reset, typography classes, form styling, layout utilities |
| `components.css` | ~143 KB | All UI components: cards, grids, buttons, modals, book covers, review forms, admin panels |

### Design Tokens

- **Spacing:** 8pt grid (`--s-1` through `--s-8`)
- **Type scale:** `--t-xs`, `--t-sm`, `--t-base`, `--t-lg`, `--t-xl`
- **Font families:** DM Serif Display (brand), Fraunces (display), Source Serif 4 (reading), Inter (body), IBM Plex Sans (UI), Source Sans 3 (secondary)
- **Colors:** Semantic tokens (`--bg`, `--surface`, `--text`, `--accent`, `--border`, `--danger`, etc.)

### Dark Mode (Dual-Selector Pattern)

Dark mode supports two activation paths simultaneously:

1. **OS preference** — Automatically activates when the user's system prefers dark
2. **Manual toggle** — `[data-theme="dark"]` attribute on `<html>`, set by `theme.js` and persisted in localStorage

The CSS pattern:

```css
/* Manual override */
[data-theme="dark"] .component { color: var(--text-dark); }

/* OS preference (only if user hasn't explicitly chosen light) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .component { color: var(--text-dark); }
}
```

This ensures: manual dark works, manual light works, OS dark works, and OS light works — all without conflicts.

---

## 10. Client-Side JavaScript

### Philosophy

All JS is vanilla (no React, no framework). Files are loaded per-page via `<script>` tags in templates. There is no bundler or transpiler — the code is ES5/ES6 written to run directly in modern browsers.

### Key Client Files

| File | Purpose |
|------|---------|
| `theme.js` | Dark mode toggle, localStorage persistence, system preference detection |
| `dialog.js` | Modal/confirm dialog helpers (`showConfirm()`, `showAlert()`) |
| `share.js` | Web Share API with clipboard fallback |
| `admin-picks.js` | Pick management UI (largest: ~31 KB) — lifecycle transitions, cover search, events CRUD |
| `nominate-form.js` | Book search via Google Books API, nomination submission |
| `vote-ballot.js` | Voting UI with drag-to-rank |
| `review-form.js` | Review submission with grade slider |
| `reactions.js` | Emoji reaction picker and toggle |
| `replies.js` | Threaded reply composition with markdown helper |
| `profile.js` | Profile editing, avatar picker, slug collision check |

### Patterns

- **Delegated event listeners** — Handlers attached to `document` for dynamically inserted elements
- **Debounced inputs** — 350ms debounce on search and slug-check fields
- **Fetch API** — All AJAX via `fetch()` with JSON request/response
- **Progressive enhancement** — Core functionality works without JS (forms submit normally); JS adds live updates, inline editing, and richer interactions

---

## 11. Grade System

14-tier letter grades from F through S:

```
F  D-  D  D+  C-  C  C+  B-  B  B+  A-  A  A+  S
```

Each grade maps to a numeric weight (F=0.0, S=4.3) stored in the `grade_weights` table. Reviews record a single letter grade plus an optional text body.

Grade visualization uses a CSS linear gradient computed from the distribution of grades on a book — each grade has an RGB color that's blended toward a warm-pebble base. The `gradeTier()` function maps grades to CSS classes (`grade-badge--a`, `grade-badge--s`, etc.) for colored badge styling.

---

## 12. Avatar System

Avatars use the [DiceBear](https://www.dicebear.com/) API — an external service that generates deterministic SVG avatars from a seed string.

- **24 styles** organized into three tabbed groups (Classic, Illustrated, Playful)
- **URL pattern:** `https://api.dicebear.com/9.x/{style}/svg?seed={display_name}`
- **Stored as:** `avatar_style` column in the `users` table (e.g., `"lorelei"`, `"bottts"`)
- **Fallback:** Display name initials rendered as text when DiceBear is unavailable
- **CSP:** Helmet allows `img-src` and `connect-src` to `api.dicebear.com`

---

## 13. Security

| Concern | Solution |
|---------|----------|
| XSS | Helmet CSP headers, EJS auto-escaping, DOMPurify sanitization on markdown |
| SQL injection | Prepared statements on all queries |
| CSRF | SameSite `lax` cookies + session validation |
| Rate limiting | express-rate-limit on all routes (300/15min), tighter limits on auth (5/15min) |
| Password storage | bcryptjs with cost factor 12 |
| Session security | httpOnly, secure (production), 30-day expiry, SQLite-backed |
| Input validation | express-validator chains with centralized error handling |
| Content policy | No iframes, no object embeds, script restricted to self + inline |
| HTML sanitization | DOMPurify whitelist (p, br, strong, em, ul, ol, li, code, blockquote, a, span) |

---

## 14. Deployment

### Fly.io Configuration

```
App:             sf-book-club
Region:          sjc (San Jose)
VM:              1 shared CPU, 1 GB RAM
Volume:          /data (auto-extends to 10 GB)
Database:        /data/bookclub.sqlite
Process:         node server.js
HTTPS:           Force-enabled, auto-stop/start machines
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SESSION_SECRET` | Yes | Session cookie signing |
| `APP_URL` | Yes | Public URL for magic links |
| `DATABASE_PATH` | Yes (prod) | Path to SQLite file |
| `BOOTSTRAP_KEY` | Once | First admin account creation |
| `GOOGLE_BOOKS_API_KEY` | No | Book metadata enrichment |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | For email | Magic link delivery |
| `SUPER_ADMIN_EMAIL` | No | Grants elevated privileges |
| `CLUB_NAME`, `CLUB_TAGLINE`, `MEETUP_URL` | No | Club branding |

### Deploy Workflow

```bash
# Local development
npm run dev         # node --watch server.js (auto-restart on changes)

# Production
fly deploy          # Builds Docker image, deploys to Fly.io
```

The Dockerfile uses `node:20-slim`, installs build tools for better-sqlite3's native compilation, runs `npm ci --production`, and exposes port 3000.

### Important Notes

- **Trust proxy** (`app.set('trust proxy', 1)`) is required for secure cookies behind Fly.io's HTTPS termination
- **Migrations run on startup** — no separate migration command needed
- **Single machine** — SQLite doesn't support multi-writer. The app runs on one Fly machine with auto-stop/start
- **Volume persistence** — The `/data` mount survives deploys; the SQLite file is never rebuilt

---

## 15. Key Architectural Decisions

### Why SQLite (not Postgres)?

The app serves a single book club with ~30 members. SQLite provides:
- Zero operational overhead (no database server to manage)
- Sub-millisecond query latency (no network round-trip)
- Synchronous API that simplifies route handlers
- WAL mode for concurrent reads during writes
- Single-file backups

The trade-off is single-machine deployment, which is acceptable at this scale.

### Why Server-Rendered (not SPA)?

EJS templates provide:
- Fast initial page loads with no JS bundle to parse
- SEO-friendly HTML for book pages
- Progressive enhancement — JS adds interactivity, but pages work without it
- Simpler mental model — one codebase, one language, no API/client boundary

### Why No Build Step?

Vanilla CSS and JS eliminate:
- Build tool configuration and maintenance
- Source map debugging complexity
- Dev server startup time
- Dependency on bundler ecosystem

The trade-off is no tree-shaking, no TypeScript, and no CSS modules. At the current codebase size (~160 KB of CSS, ~450 KB of JS), this is acceptable.

### Why Express 5?

Express 5 adds native async error handling (rejected promises automatically trigger the error handler) without requiring `express-async-errors` or manual try/catch in every route.

---

## 16. Data Flow Examples

### Member Views a Book Page

```
Browser → GET /books/:authorSlug/:titleSlug
  → routes/public.js
    → db.prepare('SELECT ... FROM books WHERE author_slug = ? AND title_slug = ?')
    → db.prepare('SELECT ... FROM reviews JOIN users ...')
    → db.prepare('SELECT ... FROM monthly_picks WHERE book_id = ?')
    → res.render('book-detail', { book, reviews, picks, ... })
  → EJS renders HTML with app-shell layout
  → Browser loads page-specific JS (reactions.js, replies.js, share.js)
```

### Admin Transitions a Pick to Voting

```
Browser → PUT /api/admin/picks/:id/status  (fetch from admin-picks.js)
  → routes/api.js → requireAdmin middleware
    → picksService.transitionStatus(pickId, 'voting')
      → Validates current state allows transition
      → Updates status + voting_open_at timestamp
      → db.transaction() for atomicity
    → res.json({ success: true })
  → Client JS reloads the pick detail section
```

### Member Submits a Review

```
Browser → POST /api/reviews  (fetch from review-form.js)
  → routes/api.js → requireMember middleware
    → validate: reviewChain + handleValidationErrors
    → reviewsService.createReview({ userId, bookId, grade, body, spoilerFlag, didFinish })
      → db.prepare('INSERT INTO reviews ...').run(...)
    → res.json({ success: true, review })
  → Client JS updates the review list in place
```
