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

## Content & Admin (Sprint 10)

- **Display name collision detection** — Real-time slug availability check on profile page; green ✓ for available, amber ⚠ with suggested alternative for taken names; `GET /api/auth/check-slug` endpoint with debounced client-side check
- **Admin replace book covers** — Admins can search Google Books from the pick detail page and replace a nominee's cover image; `downloadCover()` service validates image size (rejects placeholders <15KB); search-only approach reuses existing `/api/books/search-multi` endpoint
- **Invite someone to the club** — Any member can generate a shareable invite link from the Members page; `/join/:code` renders personalized welcome with inviter's name; invite attribution tracked on registration via both magic-link and password flows; `invites` table with use count tracking
- **Events CRUD on picks** — Admin can create, edit, and delete event sessions on any pick; events section on pick detail page with inline editing; home page hero now enriched with first event data (meeting_time, location_text); begins decoupling event details from the meetings table
- **Home hero event enrichment** — Home page hero section now pulls meeting_time, location_text, and meetup_event_url from the events table when meetings table data is empty

## Bug Fixes (Sprint 5)

- **`--amber` CSS variable** — Defined in `tokens.css`; fixes admin badge dark mode, char-count warning, and spoiler reveal background
- **Spoiler checkbox → toggle** — CSS-only restyle as sliding toggle switch
