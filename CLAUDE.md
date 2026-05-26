# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with --watch (auto-restarts on file changes)
npm start            # Start production server
fly deploy           # Deploy to Fly.io (builds Docker image, pushes to sjc region)
```

There is no build step, no linter, no test suite. CSS and JS are authored directly and served as static files.

## Architecture

**Stack:** Express 5 (CommonJS) + EJS templates + SQLite (better-sqlite3) + vanilla CSS/JS. Zero build step — no bundler, no transpiler, no framework.

**Entry point:** `server.js` bootstraps in order: Sentry → DB + migrations → security (Helmet CSP, rate limiting) → view engine → compression → body parsing → sessions (SQLite-backed) → user injection middleware → global template locals → routes → error handlers.

**Request flow:** Routes are thin controllers → validate input (via `middleware/validate.js`) → call service functions → render EJS or return JSON. No business logic in route files.

### Key directories

- `routes/` — 9 route files mounted in `server.js`. Admin routes at `/admin`, API at `/api`, everything else at `/`.
- `services/` — All business logic and DB queries. Plain functions, not classes. `monthly-picks.js` is the largest (pick lifecycle state machine: scheduled → nominations → voting → reading → results).
- `views/layouts/` — 4 shell layouts: `app-shell.ejs` (public/member), `admin-shell.ejs`, `focus-shell.ejs` (login/onboarding), `landing-shell.ejs`.
- `views/partials/` — Reusable includes (avatar, global-nav, pagination, etc.).
- `public/css/` — Three files loaded in cascade order: `tokens.css` (design tokens) → `base.css` (typography/utilities) → `components.css` (BEM components).
- `public/js/` — ~24 vanilla JS files loaded per-page via `<script defer>`. Each wraps in an IIFE.
- `db/migrations/` — Numbered SQL files (001–024). All run automatically on server start — no manual migration commands.

### Database

SQLite at `./data/bookclub.sqlite` (dev) or `/data/bookclub.sqlite` (prod on Fly.io volume). All queries use `db.prepare()` with prepared statements. Multi-step operations use `db.transaction()`. WAL mode enabled.

### Auth

Dual-mode: magic links (primary, 15-min TTL) + password (secondary, bcrypt cost 12). Two middleware gates in `middleware/auth.js`: `requireMember` and `requireAdmin`. First admin bootstrapped via `BOOTSTRAP_KEY` env var.

## CSS Rules

**Three-file architecture** — tokens go in `tokens.css`, typography/utilities in `base.css`, component styles in `components.css` (BEM naming: `.block__element--modifier`).

**Never hardcode** colors, spacing, fonts, radii, or shadows — always use CSS custom properties from `tokens.css` (e.g., `var(--s-3)`, `var(--text2)`, `var(--radius-md)`).

**Cache busting** — After any CSS change, bump the `?v=N` query string on CSS `<link>` tags in **all 4 shell layouts** (`app-shell.ejs`, `admin-shell.ejs`, `focus-shell.ejs`, `landing-shell.ejs`). Current versions: tokens `?v=17`, base `?v=19`, components `?v=59`.

**Dark mode** is handled by the token system's dual-selector pattern (`@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`). New colors must be added to both `:root` and the dark-mode selectors in `tokens.css`. Do not create separate dark-mode component styles.

## JavaScript Patterns

Vanilla JS only. Each file uses an IIFE. DOM lookup by ID (camelCase). Server data passed via `data-*` attributes. All AJAX via `fetch()` with JSON. Delegated event listeners for dynamic content.

## Deployment

Fly.io app `sf-book-club` in `sjc` region. Single machine (SQLite constraint). Persistent volume at `/data`. CI: GitHub Actions auto-deploys on push to `main`. `trust proxy` is required for secure cookies behind Fly's HTTPS termination.

## Workflow

Always branch + PR — never commit directly to main.
