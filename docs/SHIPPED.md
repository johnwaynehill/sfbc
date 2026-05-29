# GatherBound — Shipped

Everything that's been built, organized by area. Updated each sprint as items move from [BACKLOG.md](BACKLOG.md).

> For the full historical checkbox record, see [archive/ROADMAP-v1.md](archive/ROADMAP-v1.md).

---

## Core Platform

- **QR-based nominations** — Scan → nominate in <10 seconds, no login required
- **Ranked voting** — Drag-to-reorder ballot on mobile with points-based scoring
- **Live SSE results** — Real-time bar chart updates during voting
- **Admin meeting lifecycle** — Open/close nominations, voting, finalize winner
- **Monthly picks (artifacts refactor)** — Books as primary entity, meetings as instances; `monthly_picks` table decouples lifecycle from meetings *(Sprints 1-4)*
- **Lifecycle state machine** — Scheduled → Nominations → Voting → Reading → Results, with event tracking *(Sprint 4)*
- **Historical data seeding** — 30+ past meetings imported from Meetup
- **Magic-link authentication** — Email-based passwordless login
- **Password authentication** — Optional secondary auth method
- **PWA manifest** — Installable web app with offline static asset caching
- **Canonical URL slugs** — `/books/:authorSlug/:titleSlug` with collision handling

## Book Experience

- **Book detail pages** — Cover, title, author, description, metadata, grade distribution, reviews
- **Book metadata auto-fetch** — Google Books / Open Library API integration
- **Placeholder covers** — Deterministic color-hash covers when no image available
- **Grade distribution visualization** — Color gradient strip with tier axis on book detail
- **Book-to-book navigation** — Prev/next month links at bottom of book detail pages *(Sprint 5)*
- **Subjects/tags display** — Up to 6 genre tags shown on book hero section
- **Book description** — Expandable "Read more" for long descriptions
- **Immersive book hero** — Full-bleed blurred cover wash background, dramatic triple-layer shadow on cover, centered mobile layout at 260px *(Sprint 6)*
- **Hero CTA buttons** — Review + Share buttons stacked below cover; context-aware (Write a Review / Sign in to Review) *(Sprint 6)*
- **Inline metadata** — Pages, year, ISBN as compact dot-separated row in hero footer *(Sprint 6)*
- **Text-style external links** — Goodreads, StoryGraph, Bookshop with icons; accent-colored accessible links *(Sprint 6)*

## Reviews & Engagement

- **Letter-grade reviews** — 14 grades (F through S) with grade pill strip picker
- **Markdown reviews** — Bold, italic, lists, blockquotes, links, spoiler tags
- **Formatting toolbar** — WYSIWYG-style buttons above the textarea with live preview
- **Spoiler tap-to-reveal** — `||spoiler||` syntax toggles visibility on click
- **Spoiler filter** — Hide/show spoiler-tagged reviews with localStorage persistence
- **Spoiler toggle switch** — Review form checkbox restyled as modern CSS toggle *(Sprint 5)*
- **Emoji reactions** — React to any review with emoji; count + tooltip showing who reacted
- **Reply to reviews** — Threaded conversations on book detail pages
- **Review sorting** — Sort by newest, oldest, highest grade, lowest grade
- **My Reviews page** — Personal review history with grade summary and avg grade
- **My Reviews sort/filter/search** — Search by title/author, sort by date or grade *(Sprint 5)*

## Social & Community

- **Activity feed** — Home page shows reviews, replies, reactions, and nominations in real-time via SSE
- **Announcements** — Admin-published updates on Home page with live SSE delivery
- **Nominations page** — Public page showing nominations as they come in, live via SSE
- **Share a book** — Web Share API with clipboard fallback; Share CTA in hero section *(Sprint 6)*
- **Login prompts** — Review section header + empty state CTA for unauthenticated visitors *(Sprint 6)*

## Admin & Operations

- **Admin panel** — Dedicated `/admin/*` shell with separate navigation
- **Nomination → Voting → Winner pipeline** — Full lifecycle management
- **Admin picks management** — Create, edit, advance status, view details with QR codes
- **Sort and filter reviews** — Search, sort by date/grade/book in admin
- **Sort and filter users** — Search, sort by name/join date in admin
- **Promote/demote admin** — Toggle admin role on `/admin/users`
- **Link to profile from admin** — Quick link to member's public profile
- **Vote results archive** — Past vote tallies preserved and accessible
- **Block re-nomination** — Prevents nominating already-read books with friendly message
- **Live admin SSE** — Nominations appear in real-time on admin pick detail
- **Admin mobile responsive** — Hamburger nav, stacked cards, vertical stepper, full-width QR
- **Admin form field dark mode** — Icons visible in dark mode
- **Nomination rationale display** — "Why this book" reason shown on admin pick detail *(Sprint 6)*
- **Inline nominee editing** — Edit title, author, reason in-place with PUT API *(Sprint 6)*
- **Nomination search bar** — Google Books multi-result dropdown on nominate form; prevents typos, ensures covers *(Sprint 6)*

## Profiles & Identity

- **Public member profiles** — `/members/:slug` with reading stats, social links, review history
- **DiceBear avatars** — 24 styles in 3 tabbed groups
- **Profile social links** — Goodreads, StoryGraph, Instagram, Threads
- **Display names** — Set on first login, used across all participation

## UX & Design

- **Dark mode** — System preference detection + manual toggle with `data-theme` attribute
- **First Edition aesthetic** — Editorial design language inspired by record.club
- **Mobile-first responsive** — All pages designed for phone-first use
- **Home page** — Hero section with current book, Coming Up docket, Recent Reads grid
- **History page** — Browsable grid with sort (newest/oldest/alpha) and search
- **About page** — Standalone page with club description, How It Works, CTAs
- **Changelog** — Public "What's New" page at `/changelog` with collapsible entries
- **Voting page UX** — Compact cards, clear rank interaction, mobile-optimized
- **Results page animation** — Winner reveal with celebratory animation
- **Login page** — Inline form swap between magic link and password modes
- **Timezone-safe dates** — Custom `formatMeetingTime()` avoids UTC issues in production

## Security

- **Input sanitization** — All user inputs validated and sanitized
- **CSP headers** — Content Security Policy for XSS protection
- **Rate limiting** — Brute-force protection on auth and API endpoints
- **Trust proxy** — Secure cookies behind Fly.io HTTPS termination

## Reviews Polish (Sprint 7)

- **"Did you finish?" checkbox** — Review form checkbox (checked by default); stores `did_finish` in database
- **DNF badge** — Red "DNF" badge on review cards when reviewer didn't finish the book
- **Spoiler filter UX polish** — Relocated toggle to standalone strip, count badge, smooth reveal/hide animation, `aria-pressed` state
- **Grade distribution tooltips** — Hover/tap tooltips showing per-tier review counts on axis labels
- **Reply markdown helper** — Compact Bold/Italic/Spoiler/Link toolbar above reply textareas
- **Publisher & language metadata** — Auto-fetched from Google Books API; language only shown for non-English books
- **Metadata backfill** — Enrichment now backfills `page_count`, `publication_year`, `isbn` from Google Books API on page visit
- **Samsung browser light mode fix** — `color-scheme: light dark` + explicit `data-theme` in FOUC prevention script
- **View Details button spacing** — Added top margin to `.book-hero__actions` in home hero section

## Infrastructure (Sprint 7)

- **Migration FK safeguard** — `PRAGMA foreign_keys = OFF` around migration execution prevents cascade deletes when tables are dropped/recreated; `foreign_key_check` runs after each migration
- **Conditional results links** — Results links hidden on pick detail and book detail pages when no voting data exists

## Community & Polish (Sprint 8)

- **Community stats on Home** — Member count and review count displayed alongside book count in the About section
- **View own public profile** — "View public profile →" link on settings page opens `/members/:slug` in new tab
- **Masked admin emails** — Admin users page shows `j***n@gmail.com` format for privacy; search still uses full email
- **Styled dialog modals** — Replaced all 45 `confirm()`/`alert()` calls across 6 JS files with accessible `<dialog>` modals (`showConfirm()`, `showAlert()`)
- **Home hero redesign** — Tinted radial gradient background from book cover hue, 220px cover, status/month label, meeting info card, gradient fade to page, responsive mobile stack

## Admin QoL & Members Directory (Sprint 9)

- **Public members directory** — New `/members` page (auth-gated) listing all members with avatars, review counts, and join dates; inline client-side search; "Members" nav link for logged-in users
- **Better profile settings UX** — Wider card layout with section elevation, display-font headings, live slug preview below display name input, compact avatar picker grid (60px cells)
- **Admin pagination** — Server-side `LIMIT/OFFSET` for `/admin/users` and `/admin/reviews` (25/page); reusable `pagination.ejs` partial; client-side search scoped to current page via `data-total` attribute
- **Reaction & reply button polish** — 32px min touch targets, hover micro-lift (`translateY(-1px)`), visible hover backgrounds on reply trigger, active pill box-shadow
- **Password signup fix** — `POST /auth/password-login` now auto-registers new users when the email doesn't exist yet, mirroring the magic-link flow; added 8-char minimum validation

## Bug Fixes & UX Polish (Sprint 11)

- **Email `+` alias fix** — Accounts can now be created with `+` subaddress aliases (e.g. `user+club@gmail.com`); `normalizeEmail()` options updated to preserve subaddresses across Gmail, Outlook, and Yahoo
- **Admin nav cleanup** — Removed "View Site" link from admin navigation to reduce clutter
- **Enlarged Coming Up covers** — Homepage "Coming Up" section covers increased from 56px to 96px (72px on mobile) for better visual prominence
- **Unified edit/cover modal** — Merged separate "Edit" and "Cover" nominee buttons into a single "Edit" button that opens a modal dialog; modal has Title/Author fields plus cover search with Google Books thumbnails; winner callout has a standalone "Replace Cover" button in cover-only mode

## Content & Admin (Sprint 10)

- **Display name collision detection** — Real-time slug availability check on profile page; green ✓ for available, amber ⚠ with suggested alternative for taken names; `GET /api/auth/check-slug` endpoint with debounced client-side check
- **Admin replace book covers** — Admins can search Google Books from the pick detail page and replace a nominee's cover image; `downloadCover()` service validates image size (rejects placeholders <15KB); search-only approach reuses existing `/api/books/search-multi` endpoint
- **Invite someone to the club** — Any member can generate a shareable invite link from the Members page; `/join/:code` renders personalized welcome with inviter's name; invite attribution tracked on registration via both magic-link and password flows; `invites` table with use count tracking
- **Events CRUD on picks** — Admin can create, edit, and delete event sessions on any pick; events section on pick detail page with inline editing; home page hero now enriched with first event data (meeting_time, location_text); begins decoupling event details from the meetings table
- **Home hero event enrichment** — Home page hero section now pulls meeting_time, location_text, and meetup_event_url from the events table when meetings table data is empty

## Features & Usability (Sprint 12)

- **Show/hide password toggle** — Eye icon toggle on all password inputs (member login, profile, admin login, admin settings) to reveal/hide passwords; accessible `aria-label` updates on toggle
- **Extended markdown support** — Added strikethrough (`~~text~~`), headings (`### Heading`), and numbered lists (`1. item`) to review toolbar, client preview, and server rendering
- **Global library checkout link** — Admin enters a library catalog search URL in settings (e.g. SFPL); every book detail page shows a "Library" pill link that searches for the book at that library
- **Separate usernames** — Users can set a stable username independent of their display name; profile URLs use username (`/members/:username`); changing display name no longer changes the URL; admin user list shows `@username`; existing slugs seeded as usernames

## Observability & Demand Signal (Sprint 13)

- **Sentry error tracking** — `@sentry/node` integration with user context middleware and global error handler capture; silently no-ops when DSN is not configured
- **PostHog server-side analytics** — `posthog-node` wrapper in `services/analytics.js` tracking 11 events: `magic_link_requested`, `user_login`, `review_submitted`, `review_updated`, `reaction_added`, `reply_created`, `nomination_created`, `vote_cast`, `profile_updated`, `invite_created`, `meeting_status_changed`; no-ops when API key is absent
- **PostHog client-side snippet** — Browser snippet in all 4 shell layouts (app, admin, focus, landing) for automatic page views and session recording; conditional on `posthogApiKey` template local; `identified_only` person profiles
- **GatherBound landing page** — `/landing` route with dedicated `landing-shell.ejs` layout; hero, problem/solution sections, how it works, social proof stats (live data), book cover strip, organizer features grid, Tally waitlist embed; full dark mode support
- **Multi-club project docs** — Updated PRD, ROADMAP, BACKLOG, ARCHITECTURE, VISION for multi-club pivot; added MIGRATION-PLAN.md with 6-phase SQLite-based plan

## Accessibility & Hardening (Sprint 14)

- **Skip navigation** — Skip-to-content links in all 4 shell layouts (app, admin, focus, landing) for keyboard users
- **ARIA live regions** — Announcements, activity feed, login messages, and member search results announce updates to screen readers
- **Decorative SVG cleanup** — `aria-hidden="true"` added to all 47+ decorative SVGs across every view
- **Keyboard sort dropdown** — Full ARIA listbox keyboard pattern (Arrow, Home, End, Escape) for review and history sort menus
- **CSS token fixes** — Replaced undefined `--font-heading` → `--font-display`, `--text-secondary` → `--text2`; removed duplicate status-pill rules
- **Dark mode message colors** — Success/error `.nom-message` variants get proper dark-mode backgrounds

## Design Normalization & Polish (Sprint 14)

- **Missing design tokens** — Defined `--success`, `--content-width`, `--text1`, `--border-light` in tokens.css (light + dark); eliminates all CSS fallback expressions
- **Hardcoded colors normalized** — `.spoiler-badge`, `.dnf-badge`, reaction-pill active state, toast notifications, and 5 focus-ring box-shadows all converted from raw hex/rgba to `var()` or `color-mix()` with design tokens
- **Inline styles distilled** — ~25 `style=""` attributes across views replaced with utility classes (`mt-3`, `mb-4`, `w-full`, `text-center`, `text-inherit`) and new component classes (`.section--flush`, `.login-form__btn`, `.error-page`, `.review-card__anon`, `.form-label__row`, `.admin-form__row`)
- **Duplicate markup consolidated** — Home page banner CTA was copy-pasted 4 times; now uses shared `bannerStatus` variable with single template
- **Orphaned CSS removed** — Deleted unused `.book-hero__meta`, `.book-hero__meta--stacked`, `.book-hero__meeting-info` compatibility stubs
- **Mobile touch targets** — Reaction pills, reply trigger, sort dropdown items, markdown toolbar buttons all bumped to 44px min-height on ≤640px screens
- **Mobile responsive fixes** — Members page header stacks vertically, search inputs go full-width, emoji picker adapts to viewport, review form buttons stack full-width, markdown toolbar scrolls horizontally instead of overflowing
- **Review form spacing** — Removed compounding margins on spoiler/finish checkboxes (form gap + margins = 40px → now just 16px gap on mobile)
- **Grid-aligned spacing** — Bare `2px`, `6px` gaps in reaction-bar, reply-trigger, grade-picker strip, md-toolbar normalized to `--s-1`/`--s-2` tokens

## Quick Wins — UX Polish (April 2026)

- **Remove "Add Admin" from Admin Settings** — Removed the "Add Admin" form and JS handler from settings page; API endpoint preserved for future use
- **Remove "Current Results" from Admin Overview** — Removed the vote results table and cleaned up unused `calculateResults()` call from the overview route
- **Read more chevron** — Down chevron SVG added to "Read more" toggle on book detail pages; rotates 180° on expand ("Show less")
- **Admin footer** — Added `.site-footer` to admin shell layout with "View Site" and "What's New" links
- **Pick topic/theme** — New `topic` column on `monthly_picks` (migration 022); editable on admin pick detail; displayed as themed banner on nominate and nominations pages
- **Voting "About this book" link** — Replaced Google Books + Open Library links on ballot cards with single "About this book →" link to in-app book detail page; opens in new tab to preserve ballot order

## Voting Reliability & Mobile UX (May 2026)

- **Close-voting RangeError fix** — `createStmt` for `monthly_picks` was missing the `topic` parameter, throwing `Too few parameter values were provided` whenever close-voting created a new pick (no pre-linked pick on the meeting). Caused the "network error" popup admins saw closing the July session
- **Topic propagation across voting close** — When voting close creates or links a monthly pick, the meeting's topic is now copied onto the pick (was lost as `null`); server-side validation added to `meetingChain`; `POST /admin/meetings` now accepts `topic` at creation
- **Submission rate limiter re-keyed by device** — Was IP-keyed at 10/15min, so 17 members on shared venue WiFi exhausted the bucket and ~5 couldn't submit votes. Now keys by `session.userId → _client_id cookie → IP subnet` with a 60/15min cap per device
- **IP backstop limiter** — 500/15min per IP subnet catches cookie-rotation scripts that would otherwise bypass the per-device cap; trips fire a Sentry warning since rare = high signal
- **Mobile drag-and-drop voting restored** — Long-press (~250ms still) on any card activates drag mode with a `navigator.vibrate(15)` haptic blip; 10px movement threshold cancels (treated as scroll); arrows preserved as accessibility fallback. Replaces the previous "arrows-only" workaround that members found tedious. `touch-action: none` scoped to cards under `(pointer: coarse)` so iOS Safari hands the touch sequence to JS
- **Grip handle removed** — Long-press affordance replaces the visual clutter; kicks off the haptics backlog item (BACKLOG.md:109)
- **Duplicate June 2026 meeting cleanup** — One-off prod fix: removed an empty stale meeting that was rendering "To Be Decided" alongside the real Piranesi pick on the homepage

## Vote Integrity (May 2026)

- **Admin vote inspector + delete** — Hidden per-vote table on the admin pick detail page, revealed via `?show-votes=yes` (no UI link). Shows voter identity, ranking, and submitted time; `DELETE /api/admin/votes/:id` removes an errant/duplicate vote and recalculates + rebroadcasts results over SSE. `getVotesForMeeting()` added to `services/voting.js`. Used to fix a prod incident where an accidental duplicate vote had changed a winner
- **One vote per logged-in user** — Dedup was previously cookie-fingerprint only, so a member could vote, open a private window, log in again, and vote a second time. Now enforced at the app layer (`hasUserVoted()`) and the database (partial unique index `(meeting_id, user_id) WHERE user_id IS NOT NULL`, migration 026), with a constraint-violation guard on insert. Existing duplicate user votes are deduped in the migration (keeps each user's earliest)
- **Anonymous IP soft-flag** — `submitted_ip_hash` (migration 029) stores `HMAC(secret, "ip:<ip>:<meeting_id>")` — never the raw IP, salted per-meeting. The vote inspector groups votes sharing a network and flags clusters (`⚠ N · <label>`, `.vote-network-flag`) so admins can spot cookie-reset duplicates. Soft-flag only — **never auto-blocks**, since in-person meetups share one venue IP. Login intentionally not required to vote

## Analytics Expansion & Dashboards (May 2026)

- **11 new server-side events** — `vote_rejected`, `nomination_rejected`, `login_failed`, `magic_link_failed`, `magic_link_consumed`, `account_created` (split from `user_login`), `invite_redeemed` (closes the invite funnel with `invite_created`), `book_search_no_results` (only fires on empty results — no keystroke firehose), `meeting_viewed` (kind: `vote | nominate | nominations_live`), `book_viewed`
- **3 activation milestones** — `first_review_submitted`, `first_nomination_created`, `first_vote_cast` fire exactly once per user, alongside the regular event; race-free via post-insert count or "exclude current meeting" detection
- **`votes.user_id` migration (024)** — Added nullable `user_id` so first-vote detection works for logged-in voters; anonymous votes leave it `NULL`
- **`meetings.topic` migration (023)** — Topic moved off `monthly_picks` (which doesn't exist until voting closes) onto `meetings`, with backfill from any linked pick. Mirrored to pick on update
- **Distinct-ID standardization** — `nomination_created` was using literal `'anonymous'` (collapsing all anon nominators into one PostHog person); now uses the per-meeting fingerprint to match `vote_cast`
- **Two PostHog dashboards** — *Engagement & Health* (rate-limit hits, vote/nomination rejections, login failures, DAU, success ratios, search dead-ends) and *Funnels & Growth* (signup, invites, nomination/voting flows, club-pick → review, three activation funnels)
- **`docs/Analytics.md`** — Full catalog of events, distinct-ID strategy, dashboard contents, "adding a new event" patterns, HogQL verification snippets, known limitations

## Landing Page Redesign (May 2026)

- **Conversion-focused `/landing` rebuild** — Reworked ahead of driving waitlist traffic, guided by a competitive analysis of book-club and community-SaaS landing pages. Concrete outcome-first hero headline ("Give your book club a home between meetings"); dual CTA (primary "Join the waitlist" + secondary "See a live club →"); inline trust line with live stats under the hero; sticky header waitlist CTA; reframed feature heading ("Everything your club needs"); social-proof stats kept as a "By the numbers" block
- **Live-data product showcase** — New "Take a peek inside" section renders two browser-chrome mockups (`.lp-frame`) built from real DB data via the `showcase` local on the `/landing` route: the club home (currently-reading hero + recent-reads strip) and a book archive page (real club-average letter grade + a real, spoiler-free member review as a pull quote). Both link to the live club, so the showcase is genuinely the running product and never goes stale — no static screenshots to maintain
- **Placeholder testimonials** — `.lp-voices` section with clearly-marked placeholder quotes to be replaced with real member/organizer quotes before launch
- **Native waitlist form** — Replaced the embedded Tally iframe (off-brand, required scrolling-within) with a native form (`name`, `email`, optional `club name` + `city/state`) styled into the dark CTA bookend. `POST /waitlist` validates (`sanitizeTextChain` + `emailChain`), rate-limits 10/hr/IP, drops honeypot submissions, stores to a new `waitlist_signups` table (`services/waitlist.js`, migration 030, idempotent on email), fires a `waitlist_signup` analytics event, and emails `superAdminEmail` on each new signup. Inline success state, no page reload. Covered by 9 service + route tests
- CSS: new `lp-showcase`/`lp-frame`/`lp-preview-*`/`lp-voices`/`lp-form`/`lp-header__cta`/`lp-hero__actions` blocks in `components.css` (token-only, dark-mode + mobile handled); bumped components cache to `?v=82`

## Dev Workflow (May 2026)

- **HOST env override** — Dev binds to `localhost` by default; `HOST=0.0.0.0` makes the server reachable from another device on the LAN (e.g. testing the voting page on a real phone)
- **Dev CSP `upgrade-insecure-requests` disabled** — Helmet's default would force every CSS/image/font subresource to https when accessed from a LAN IP, breaking on-device dev testing. Disabled in dev only; production behavior unchanged

## Bug Fixes & Quality of Life (May 2026)

- **Case-insensitive book matching** — `findOrCreateBook()` now uses `COLLATE NOCASE` for title + author, plus a Google Books ID fallback, preventing duplicate book records from case variations *(GAT-42, GAT-43)*
- **Already-read check fixed** — Nomination guard now queries `monthly_picks` instead of the legacy `meetings` table, so only books in the public history are blocked; error message includes when the book was read *(GAT-42)*
- **Consistent member counts** — Admin dashboard, About page, and Members directory all use the same `COUNT(*) FROM users` query *(GAT-44)*
- **Stale ballot reconciliation** — When an admin removes a nominee during active voting, the server silently strips removed book IDs and appends any new nominees, so votes go through without a page refresh *(GAT-45)*
- **Results page book details** — Each results bar is now clickable, opening a book details modal (desktop) or bottom sheet (mobile) with cover, description, subjects, and nomination reason *(GAT-46)*
- **Admin cover search pagination** — Cover replacement modal loads 5 results at a time with a "Show More" button for browsing beyond the first page *(GAT-11)*
- **Admin reviews redesign** — Reviews are collapsed by default; clicking "View" opens a centered modal (desktop) or bottom sheet (mobile) with full review content and the delete action *(GAT-31)*

## Bug Fixes (Sprint 5)

- **`--amber` CSS variable** — Defined in `tokens.css`; fixes admin badge dark mode, char-count warning, and spoiler reveal background
- **Spoiler checkbox → toggle** — CSS-only restyle as sliding toggle switch
