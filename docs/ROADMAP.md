# GatherBound — Roadmap

> **[VISION.md](VISION.md)** — Why we exist and where we're headed.
> **[PRD.md](PRD.md)** — Full product specification.
> **[BACKLOG.md](BACKLOG.md)** — Prioritized items for sprint planning.
> **[SHIPPED.md](SHIPPED.md)** — Everything we've built so far.

---

## Where We Are

GatherBound has a working product serving the SF Fantasy & Sci-Fi Book Club (900+ members, ~25 per meeting). Across 5 sprints, we shipped the full core loop: admins run a complete nomination → voting → reading → results lifecycle via a state machine (Scheduled → Nominations → Voting → Reading → Results). Members write letter-grade reviews with markdown and spoiler support, and non-attendees participate through emoji reactions, replies, and a real-time activity feed.

The **artifacts-as-center architecture** is in place. Books are the primary entity; meetings are instances attached to monthly picks. The `monthly_picks` table decouples lifecycle from meetings. Canonical URL slugs, book-to-book navigation, metadata sections, and a browsable 30+ book archive are all shipped. This foundation enables everything ahead.

The **tool for organizers and attendees** is done. The question now is: *does the app make someone who's never been to a meeting feel like a member?* The answer today is "sort of" — they can browse, react, and reply, but there's no moment where the app says "you belong here." The next milestone focuses on making the book page magnetic enough to earn repeat visits from the 875+ who experience the club through the app.

---

## Strategic Milestones

### 1. The Book Page is the Destination

*Vision principle: "The artifact is the center" + "The archive is the product"*

The book detail page should be the richest, most engaging part of the app — worth visiting months after the meeting. Today it has reviews, grades, and metadata. It needs to feel like a permanent cultural object that earns repeat visits.

The gap isn't features — it's the book page not yet being *magnetic*. Someone who wasn't at the meeting has no compelling reason to come back after reading the reviews once. The page is informative but not immersive, and there's no on-ramp for visitors to become participants.

**Key capabilities (sprint priority order):**
- Book cover as hero element (larger, background color, immersive) — highest-leverage visual change
- Metadata section UX polish (pages, publish date, ISBN, language in a clean layout)
- Separate metadata from secondary CTAs (Goodreads, StoryGraph, Bookshop.org as distinct action row)
- Login prompt in Reviews section (guide unauthenticated visitors to participate — cheapest growth lever for the 875+)
- Share a book externally (social/messaging links — if the page is the destination, people need a way to send it)
- Nomination search bar (quality gate for incoming data — bad nominations degrade the entire archive)
- Admin-managed book covers (replace, upload, fetch by ISBN)
- Extended markdown in reviews (more formatting options)
- Library checkout integration (link to local library catalog)

**Why this is next:** The book page is where all engagement happens — reviews, reactions, replies. Making it richer and adding an on-ramp (login prompt) and a share mechanic is the smallest package that starts to shift the 875+ from passive browsers to active members.

---

### 2. Every Member Belongs

*Vision principle: "Participation doesn't require attendance"*

For most members, the app IS the club. They need ways to build identity, track their reading, and feel like part of the community — without ever sitting in a meeting room.

**Key capabilities:**
- Reading status per member (Reading, Read, DNF, Did Not Read)
- Richer member profiles (stats, favorites, reading history)
- Public members page (browse who's in the club)
- Usernames + display name collision detection
- View own public profile (see how others see you)
- Photo upload avatars (alongside DiceBear)
- Tag-based filtering on History (deferred from M1 — needs 60+ books to justify)
- Author pages (deferred from M1 — needs repeat authors to justify)

**Why this matters:** The PRD's success metric is "members who have never attended a meeting submit reviews or reactions." Identity and belonging drive long-term engagement. Note: login prompt and share link moved to Milestone 1 — they serve the book page destination thesis directly.

---

### 3. The Meeting Gets Better

*Vision principle: "In-person is sacred" + "Organizers are users too"*

The core meeting flow works. Now make the in-person experience richer for attendees and easier for organizers. Multiple meetings per book is architecturally supported — these features make it practical.

**Key capabilities:**
- Facilitator role (per-meeting designation with guides and tools)
- Club calendar view (visual calendar of past and upcoming meetings)
- Discussion guide with questions (user-submitted, sourced, AI-generated)
- Ice-breaker question generator (book-specific, tone selection)
- Meeting check-in button (attendee presence confirmation)
- Meetup.com data pull (attendee count, rating — cached weekly)
- Multiple meetings per Pick (allows many more people to meet in-person, growing the history and culture)

**Why this follows Milestone 2:** The meeting experience improves most when members already have identity and reading status — facilitators can see who's read the book, discussions can reference online conversations.

---

### 4. Polish & Platform

*Vision principle: "Editorial, not social" + Platform thesis*

Refine the experience to feel truly editorial and curated. Then lay the groundwork for GatherBound to serve any in-person club, not just ours.

**Key capabilities:**
- Client-side dialogs (replace browser alerts with styled modals)
- Home page hero section redesign (larger, more immersive)
- Reaction and reply visual design update
- @ mentions in replies
- Admin pagination and operational polish
- Multi-club configuration foundation (env-based identity, swappable tokens)
- Artifact-type expansion readiness (films, albums — same model, different content)

**Why this is last:** Platform capabilities only matter when the single-club experience is exceptional. Polish the product for our 900 members before building for thousands of clubs.

---

## Parked Ideas

Ideas that don't justify the effort right now but are architecturally noted:

| Idea | Why it's parked |
|---|---|
| Custom emoji | Needs admin approval flow, low impact at current scale |
| User blocking | Safety feature — important but low urgency for in-person club |
| Saved quotes from books | Compelling but niche; needs UI design work |
| Badges & gamification | Attendance, review, nomination badges — needs check-in feature first |
| StoryGraph integration | No stable public API; fragile dependency |
| Full artifact type expansion | Only needed when another club actually exists |
| Supporter/premium tier | No monetization pressure yet |

---

## How We Work

- **Sprint planning** pulls from [BACKLOG.md](BACKLOG.md), which has every item sized and prioritized
- **Sprint plans** live in `.claude/plans/` as ephemeral working docs
- **Completed work** moves from BACKLOG → [SHIPPED.md](SHIPPED.md) each sprint
- **Bugs** are tracked in [Bugs.md](Bugs.md) for field-reported issues
