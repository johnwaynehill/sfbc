SF Fantasy & Sci-Fi Book Club App

## Product Requirements Document (PRD)

Product: SF Fantasy & Sci-Fi Book Club App
Owner: You
Date: February 8, 2026

---

# 1. Product Vision

**Meetings are temporary. Memory should not be.**

The SF Fantasy & Sci-Fi Book Club has met monthly in San Francisco for years — nominating books, voting, reading, and discussing together. But every meeting vanishes the moment it ends. The nominations, the debates, the votes, the reactions — none of it is preserved. The club uses Strawpoll (ad-ridden, disposable) and scattered Google Docs. There is no permanent record of what was read, when, or what anyone thought about it.

This app transforms that ephemeral ritual into a lasting cultural artifact.

It is not a dashboard. It is not a social network. It is an editorial archive — a living record of shared imagination, designed to feel permanent and meaningful. Every book the club reads becomes a collectible page. Every review becomes part of the record. The history grows month over month into something worth browsing, sharing, and remembering.

**Product thesis:** When an in-person club gets a beautiful, frictionless tool that preserves its shared life, participation deepens, identity strengthens, and the community becomes more durable over time.

---

# 2. Background / Context

The club (~35 active members) meets monthly, typically the last Wednesday. Members vote in person three months ahead (e.g., July votes for October's book). The current workflow — Strawpoll for voting, loose coordination for nominations — introduces ads, friction, and zero historical memory.

The new app should:
* Support nominations and ranked voting in person via QR code scan.
* Keep a public, browseable archive of every book the club has read.
* Allow authenticated members to leave letter-grade reviews.
* Feel like a curated editorial experience, not a utility tool.

---

# 3. Goals

* Replace Strawpoll with a fast, ad-free voting flow that works on phones in person.
* Preserve every meeting's selections, votes, and reviews as a permanent, browseable archive.
* Store history and reviews in human-readable Markdown as a durability layer.
* Keep participation friction low (QR scan → nominate/vote in <10 seconds, no login required).
* Allow review attribution for members via magic-link authentication.
* Keep the architecture to be open to future social interactions like Liking other people's reviews with emoji, etc. 
* Keep Admin section separate from the main navigation. Admins can just bookmark the link directly. Admin section should be in a different structure all together.

---

# 4. Non-Goals

* Replacing Meetup for events.
* Building a full social network or forum. But, be open to a light social network in the future.
* Complex moderation workflows beyond basic admin controls.

---

# 4A. Priority Tiers (MVP Scope Control)

Not all features carry equal weight. Use these tiers to guide build order and cut-line decisions.

## P0 — Must Ship (Core Loop)
Without these, the app cannot run a single meeting end-to-end.

* Admin can create a meeting, open/close nominations, open/close voting.
* Attendees can scan QR → nominate a book (no login).
* Attendees can scan QR → rank nominees and submit vote (no login).
* Live results update in real time via SSE.
* Admin can finalize winner.
* Home page shows current book and meeting state.
* History page shows past selections with covers.
* Book Detail page with cover, title, author, meeting date.

## P1 — Should Ship (Completes the Experience)
These make the product feel whole but are not blockers for the first live meeting.

* Magic-link authentication for members.
* Review submission (grade + markdown comment).
* My Reviews page (personal review history).
* Book metadata auto-fetch (Google Books / Open Library).
* Admin dashboard with QR panel, nomination management, results export.
* Anonymous public reviews on Book Detail page.
* Grade distribution visualization on Book Detail page.

## P2 — Nice to Have (Polish & Durability)
Ship after the core experience is solid.

* PWA manifest and offline caching of static assets.
* Offline draft storage with retry for nominations/votes.
* Markdown export to Fly.io persistent volume and/or object storage.
* Canonical URL slugs (`/books/:authorSlug/:titleSlug`) — implemented in Phase 2.
* Historical data seeding (32 past meetings from Meetup).
* About section on Home page.
* Slug collision handling.

## Future (Post-MVP)
Tracked for architectural awareness but explicitly out of scope for v1.

* Emoji reactions on reviews.
* Personal reading queue / "want to read" state.
* Lightweight member profiles.
* Supporter/premium features.
* Multi-club / platform capabilities.

---

# 5. Personas

* Admin organizer.
* Attending member (in-person voter).
* Casual public visitor (reads history only).

---

# 6. User Stories

* As an admin, I can open and close a nomination session from my phone.
* As an attendee, I can scan a QR code and submit a nomination without logging in.
* As an attendee, I can rank nominees on a phone and see live results.
* As an admin, I can close voting and share the winner.
* As a member, I can log in via magic link and leave a letter-grade review.
* As a member, after magic-link sign-in I can set a display name used across participation and reviews.
* As a member, I can see my own review history.
* As a public visitor, I can browse book history without seeing reviewer names.

---

# 6A. User Journeys (UX)

## Nominate (attendee, in-person)

Scan QR -> nomination form -> (optional) confirm book details/cover -> submit -> success confirmation -> optional "View live results" link (if open).

## Vote (attendee, in-person)

Scan QR -> ranked ballot -> submit -> live results screen (auto-updating) -> final results when closed.

## Review (member, post-meeting)

Request magic link -> email link -> set display name (first login only) -> review form (grade + comment) -> confirmation -> "My Reviews".

## Browse (public)

History list -> book detail -> anonymous reviews (no names) -> optional filter/search.

## Admin (organizer)

Open nominations -> monitor count -> close -> open voting -> monitor count + live results -> close -> publish winner -> export/share.

---

# 6B. Information Architecture (Pages)

* Home / Landing
* History (public)
* Book Detail (public, anonymous reviews)
* Nominate (QR entry, no login)
* Vote (QR entry, no login)
* Live Results (auto-updating)
* Review (magic link)
* My Reviews (authenticated)
* Admin Dashboard (open/close controls, counts, exports)
* Optional: Book lookup / details preview (for nomination validation)

---

# 6C. Admin Information Architecture 

The Admin experience should be a dedicated mode under /admin/* with its own navigation and page layout, separate from public pages.

## Overview (/admin)

## Nominations (/admin/nominations)

## Results & Exports (/admin/results)

## Settings (/admin/settings)

### Admin UX Goals

* Reduce cognitive load by showing only high-frequency actions on Overview.
* Move destructive and low-frequency actions into clearly marked sections.
* Keep meeting flow obvious: Open nominations -> Close nominations -> Open voting -> Close voting/archive.
* Maintain mobile usability with clear status indicators and large action targets.

---

# 6D. Page Definitions & Content Structure

Each page has a clearly defined primary purpose, hierarchy, and required content blocks to ensure consistency and reduce design ambiguity.

Pages should feel editorial and immersive — similar to record.club — prioritizing browsing, discovery, and clarity over feature density.

---

## Home / Landing Page

### Meetup Data Strategy (MVP)

* Meetup integration should be manual for MVP.
* Admin enters meeting_time, location_text, and meetup_event_url in Admin panel.
* Avoid automated scraping or API integration initially.

**MVP complete when**
- Admin can run one full meeting end-to-end without fallback tools.
- 10+ concurrent users can vote without performance issues.
- History pages render without JS.


### Purpose

Orient new visitors, provide quick entry into current meeting flows, and showcase club identity and history.

### Primary Actions

* See information about the Book Club
* Hero section featuring the  Current Book we are reading.

  * Large image
  * Author information
  * Link to the book details
* See information about the next meeting (time & place, from meetup.com)
* Participate in current flow (Nominate or Vote)
* Browse history

### Content Blocks

1. Header Section

   * Club name
   * Global navigation links (Home, History, My Reviews, Login/Logout)

2. Current Book Panel

   * Cover image
   * Title + author
   * Meeting date
   * Primary CTA to Book Detail page

3. Current Action Banner (Dynamic)

   * Large CTA button:

     * Nominate
     * Vote
     * View Results

4. Recent History Preview

   * Last 3 books with covers
   * Static card grid layout (no horizontal carousel)
   * Medium sized cards with the book covers featured prominently

5. About Section (Minimal)

   * Short description
   * Link to Meetup page

---

## History Page

### Purpose

Provide a browse-able archive that reinforces longevity and credibility.

### Primary Action

Browse past selections.

### Content Blocks

* Grid of books with:

  * Cover image
  * Title
  * Author
  * Month/year
  * Average grade (if available)
* Search/filter controls:

  * Search by title, author, or month/year
  * Scope filter: All, Upcoming, Past

### Interaction

* Click → Book Detail page.

---

## Book Detail Page

### Grade Weight Mapping (Implementation Guidance)

To allow calculation of averages and charts, grades should map to numeric weights.

Suggested default mapping (adjustable later):

* S = 4.3
* A+ = 4.0
* A = 3.7
* A- = 3.3
* B+ = 3.0
* B = 2.7
* B- = 2.3
* C+ = 2.0
* C = 1.7
* C- = 1.3
* D+ = 1.0
* D = 0.7
* D- = 0.3
* F+ = 0.2
* F = 0.1
* F- = 0.0

Implementation Note:

* Numeric mapping is used only for calculations and visualizations; users always see letter grades.

### Purpose

Create a "record.club-style artifact page" for each selection.

This should feel like a permanent cultural object.

### Content Blocks

1. Hero

   * Large cover
   * Title / Author
   * Meeting month/year

2. Metadata Panel

   * External links (Goodreads, StoryGraph, Google Books)
   * Nomination notes (optional future)
   * Future:

     * Link to add to reading list (on preferred external app)
     * Link to SF Public Library for getting book
     * Link to Amazon listing with affiliate link so the book club can get some money in\

3. Review Summary

   * Average grade
   * Grade distribution visualization

4. Reviews List

   * Anonymous public view
   * Markdown rendering

5. Authenticated View Enhancements

   * Display reviewer names.
   * Edit own review.

---

## Nominate Page

### Purpose

Ultra-fast in-person entry.

### Requirements

* No navigation chrome except minimal header.
* Focus mode layout.

### Content Blocks

* Title input
* Author input
* Cover auto-fetch preview
* Optional: Why this recommendation input
* Submit button
* If signed in, show "Nominating as {display name}"
* Persist signed-in nominator identity on submissions so voting cards can display "Nominated by {display name}".
* If nomination came from an anonymous attendee, omit nominator identity text.

### UX Rules

* <10 seconds completion target.
* Show confirmation state immediately.
* auto-focus first field
* enter key submits
* minimal validation
* auto-fetch metadata silently

---

## Vote Page

### Metadata Source Rules (Book Data)

When auto-fetching book metadata:

* Primary source: Google Books API.
* Secondary fallback: Open Library API.
* If metadata is missing, allow manual entry and mark fields optional.

Implementation Notes:

* Store external IDs (google_books_id / open_library_id) when available.
* Cache metadata after first fetch to avoid repeated API calls.

### Purpose

Fast ranked ballot designed for physical-room interaction.

### Content Blocks

* Initial order should be randomized per user.
* Drag-to-reorder list.
* Clear instruction text.
* Submit CTA.
* "Votes counted: X" indicator.
* If signed in, show "Voting as {display name}".
* Each nomination should feature

  * Medium-sized book cover
  * Author
  * Date of publication
  * Number of pages
  * Why this recommendation, from nomination
  * Name of person who submitted
  * Link to details on Open Library, Google Books, or Good Reads\

### After Submit

* Transition directly to Live Results page.

---

## Live Results Page

### Color Assignment Rules (Implementation Guidance)

* Each nomination should use a color from a predefined accessible palette.
* Colors must maintain sufficient contrast against backgrounds.
* Colors should be reused cyclically from a fixed palette rather than generated randomly.

### Purpose

Create shared excitement during meetings.

### Content Blocks

* Real-time bar chart.

  * Horizontal bars
  * Each nomination should be a different color
  * Features a medium-sized book cover
* Ranked list.
* Live vote count.
* Status indicator.

  * Vote open/closed
* Winner

  * Shown only after voting is closed
  * Links to Book Details

---

## Review Page

### Purpose

Post-meeting reflection.

### Content Blocks

* Grade selector (S, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F+, F, F-).
* Markdown comment box.
* Submit.

---

## My Reviews Page

### Purpose

Create identity + ownership for members.

### Content Blocks

* List of reviews.
* Grade summary.
* Edit links.

---

## Admin Pages

(Admin IA defined separately.)

# 6E. Meeting State Model (Core Product Logic)

The application is primarily driven by Meeting State.

Each meeting has a single active state:

- Reading (default)

- Nominations Open

- Voting Open

- Results Published

Homepage content and QR routes adjust based on the current state. Global navigation remains static and predictable to avoid user confusion.

Only admins can change state.

QR routes automatically redirect based on state.

# 6F. Record.club Patterns to Adopt (Design Philosophy)

The product should incorporate core interaction and structural patterns inspired by record.club in order to create a browsing experience that feels alive, curated, and culturally meaningful rather than purely functional.

These patterns are intended to guide future design decisions without expanding current scope unnecessarily.

---

## 1. Artifact-First Object Pages

Each selected book should feel like a permanent cultural artifact rather than a database entry.

Design Goals:

* Book Detail pages should feel editorial and collectible.
* Strong visual identity anchored by book cover imagery.
* Persistent canonical URLs for sharing.
* Contextual information such as meeting month/year reinforces historical continuity.

Implementation Notes:

* Emphasize large hero visuals and clean metadata presentation.
* Avoid clutter; prioritize reading experience and cultural framing.

---

## 2. Personal Organization (Future-Friendly, Not Required for v1)

Record.club succeeds partly because it supports personal tracking alongside social discovery.

Future Concepts (not required for MVP):

* Personal reading queue or "want to read" state.
* "Currently Reading" or "Up Next" indicators.
* Ability to track books nominated by the member.

Design Principle:

* The app should remain useful even when not actively voting.

---

## 3. Identity Surfaces (Private-First)

Rather than building a public social network, identity should initially exist in a private or semi-private form.

Future Enhancements:

* Expand "My Reviews" into a lightweight profile/dashboard.
* Personal review history and grade distribution.
* Favorites or top-rated books based on personal grades.

Goal:

* Reinforce ownership and long-term engagement without introducing heavy social complexity.

---

## 4. Lightweight Social Feedback (Future Capability)

Inspired by record.club's minimal social interactions, the app may support small, low-friction engagement mechanisms.

Future Possibilities:

* Emoji reactions or "likes" on reviews.
* Viewing reviews a user has reacted to.

Design Constraint:

* Avoid full comment threads or complex social moderation.

---

## 5. Supporter / Premium Features (Future Consideration Only)

Inspired by record.club's supporter tier, the architecture should remain open to optional premium or supporter functionality in the future without affecting core flows.

Possible Future Features:

* Private notes visible only to the author.
* Advanced list export or cloning features.
* Additional customization or personalization tools.

This section represents long-term optional enhancements and should not impact MVP scope or complexity.

# 6. Functional Requirements

## Nominations

* Admin can open nominations for a meeting.
* Attendees submit title and author anonymously via a QR code link.
* Admin can close nominations manually.
* Admin sees a live count of how many people have submitted nominations.
* Limit to one nomination per person per meeting.

## Voting

* Admin can open a ranked-choice ballot after nominations close.
* Attendees can rank nominees on mobile.
* Live results update during voting.
* Admin can close voting and finalize the winner.
* Winner is saved to history.

## Reviews

* Reviews require magic-link login.
* Reviews use the following letter grades: S, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F+, F, F-.
* Review comments optional.
* Public views hide reviewer names.
* Authenticated users can view their review history.
* “Remember this device” session lasts 30 days.

## History

* History is publicly viewable without login.
* Each month’s book page shows title, author, month/year, and reviews without names.

## Admin Mode

* Admin pages must use a dedicated admin navigation shell.
* Overview must display current state and top-level meeting controls.
* Nominations must contain nomination CRUD and nomination count.
* Results & Exports must contain leaderboard, exports, and backup actions.
* Settings must contain admin account management and operational actions.
* Admins authenticate with email + password (multiple admins supported).
* Bootstrap first admin via server-side bootstrap key (one-time).
* Admin transitions require preflight checks + confirmation for destructive actions.”

---

# 7A. UX States & Error Handling

## States

* Nominations: closed, open, closed (with submissions).
* Voting: closed, open (live), closed (finalized).
* Reviews: open (post-meeting), closed (if archived).

## Errors / Edge Cases

* Duplicate nomination -> prompt to confirm or edit.
* Empty nomination list -> admin warning before opening vote.
* Expired magic link -> resend flow.
* Slow or offline network -> retry + save draft locally.
* Late arrival during voting -> allow vote if still open; otherwise show final results.
* Nomination limit reached -> show “already nominated this month” message.

---

# 8. Ranking Rules (Single Method)

* Ballots are ranked lists of nominees.
* Scoring uses a points system where top rank receives points equal to number of nominees, descending by rank.
* Live results and final winner both use this same points method.

---

# 8A. Interaction Design Notes

* Ranked ballot uses drag-to-reorder on mobile; tap-to-rank fallback if drag fails.
* Live results display as a horizontal bar chart with current points and total votes counted.
* Results screen shows a "Votes counted: X" indicator and updates in real time.
* Public reviews display without names; authenticated views show display names.
* Display names are collected after first magic-link login and used instead of email attribution.
* Review grade selector includes S and A+ at the top.

---

# 9. Data Storage

## Canonical Data

* SQLite (or equivalent) is the source of truth for meetings, books, nominations, votes, users, and reviews.

## Markdown Exports (durability + easy editing)

* The system can generate Markdown snapshots for:

  * Public history pages (by month)
  * Book detail pages (optional)
  * Review collections (optional)
* These exports are written to Fly.io-attached persistent storage (and optionally mirrored to object storage or git for version history).

## Guiding Rule

* The app must never treat Markdown files as the canonical database during live operation. Markdown is an output/export format.

---

# 10. Privacy & Access

* Public access to history and reviews without names.
* Login required for reviews.
* Admin access required to open/close nominations and voting.

---

# 11. UX / Visual Direction

* **First Edition** aesthetic — clean editorial archive inspired by record.club (see [Design-Specs.md](Design-Specs.md) for full visual system).
* Fantasy/sci-fi tone comes from content (book covers, titles), never from themed UI decoration.
* Mobile-first layout.
* Large tap targets and fast flows for in-person use.
* QR code entry points for nominations and voting.
* Maintain accessibility targets: high-contrast text against white backgrounds, minimum 44px tap targets.
* Provide external review links (e.g., Goodreads/StoryGraph) on book detail and voting info panels.

---

# 12. Technical Requirements

→ **See [Tech-Specs.md](Tech-Specs.md) §1** for full technical requirements.

Summary: Node.js backend, SMTP mail for magic-links, SSE for real-time updates, responsive mobile UI.

---

# 13. Success Metrics

**Operational (is the tool working?)**
* 90%+ of attendees complete nominations and voting on mobile without assistance.
* 75%+ of attendees can see live results within 2 seconds of vote submission.
* Admin can run one full meeting end-to-end without fallback tools.

**Engagement (is the archive compelling?)**
* 50%+ of members submit at least one review per quarter.
* History and Book Detail pages receive organic traffic between meetings (not just on meeting day).
* Members share Book Detail URLs externally (social, messaging).

**Cultural (is the product thesis working?)**
* The club's history feels browseable and worth revisiting.
* New members use the archive to catch up on what the club has read.
* The archive grows richer over time without additional admin effort.

---

# 14. Risks

* Magic-link email deliverability delay.
* Live results scaling if many users join at once.
* Points-based ranking may be perceived as less intuitive than instant-runoff.

---

# 15. Open Questions

None.

---

# 16–20. Technical Implementation Specs

→ **See [Tech-Specs.md](Tech-Specs.md)** for all technical implementation details:

| Tech-Specs Section | Content |
|---|---|
| §2 Data Model | Entities: Meeting, Book, Nomination, Vote, Review, User, MagicLinkToken |
| §3 Identity & Fingerprinting | Best-effort duplicate submission prevention for anonymous QR flows |
| §4 Routes & API Contracts | All GET/POST endpoints for public, QR, auth, review, and admin flows |
| §5 PWA & Offline | Web App Manifest, offline caching, draft retry on connectivity loss |
| §6 Rendering Strategy | Server-rendered HTML + progressive enhancement (no SPA) |
| §7 URL & Slug Strategy | Canonical IDs, human-readable slugs, redirect rules, slug generation algorithm |

---

# 21. Design Direction Spec (Visual & Interaction System)

→ **See [Design-Specs.md](Design-Specs.md)** for the complete visual and interaction system.

Design-Specs.md contains all implementation details for the **First Edition** aesthetic:

| Design-Specs Section | Content |
|---|---|
| §1 Aesthetic Lock | First Edition core vibe and non-negotiables |
| §2–4 Philosophy & Layout | Design philosophy, typography system, layout & spacing |
| §5 Visual North Star | Editorial composition target and record.club alignment |
| §6 Design Tokens | Typography, layout, and color tokens + full CSS `:root` block |
| §7–9 Component Styling | Cards, buttons, links, motion, typography guidelines, scale & rhythm |
| §10–11 Composition Rules | Content dominance, color system guidance |
| §12–14 Motion & Density | Motion language spec, visual density strategy |
| §15–16 Layout Patterns | Editorial layout patterns, mobile grid system |
| §17–22 Interaction Models | Hierarchy ladder, friction principle, weighting model, navigation gravity, attention flow, single story per screen |
| §23–26 Components | Canonical components (28 total), component inventory by page, anatomy guidelines, layout constraints |
| §27 Interaction States | Button, nominate, vote, and live results state models |
| §28–29 Blueprints & Style | Page blueprints, component style guidance |
| §30 Emotional Tone Mapping | Per-page emotional posture and design implications |
| §31 Information Horizon | Progressive disclosure model |
| §32 Mood Board | Design references and visual alignment guidance |

---

# 22. Platform Future (Architectural Awareness)

→ **See [Tech-Specs.md](Tech-Specs.md) §8** for full platform future details.

This section is NOT in scope for v1. It exists to ensure that foundational decisions do not accidentally prevent future scaling. Key protections:

* **Keep the meeting state model clean** — it generalizes to any club type.
* **Use the canonical component system** — BookHero, BookCard, ReviewCard are reusable across clubs.
* **Keep data model boundaries sharp** — Book is canonical; Meeting is contextual.
* **Do not hardcode club identity** — use configuration/env vars for name, tagline, links.
* **Keep First Edition tokens in their own layer** — future clubs swap tokens, not components.

---
