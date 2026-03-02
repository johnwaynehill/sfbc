# GatherBound — Roadmap

→ **See [VISION.md](VISION.md)** for the product vision and platform thesis.
→ **See [PRD.md](PRD.md)** for the product specification.

---

## The Core Unlock: Artifacts as Center

### What changes

Currently, **meetings** are the pivot on which everything rests. The meeting state machine (reading → nominations → voting → results) orchestrates the entire app. This limits us to one meeting per book, one book per month, 25 people per cycle.

The refactor: **the cultural artifact (book) becomes the center.** Meetings become instances attached to an artifact. This enables:

- **Multiple meetings per book** — Run 3-4 discussion sessions for the same book, serving 75-100 people instead of 25
- **Engagement without attendance** — The book detail page becomes the hub: reviews, discussions, quotes, reading status — all tied to the book, not a meeting
- **Future expansion** — Other artifact types (movies, podcasts) use the same model
- **Richer book pages** — Everything about a book lives in one place across months and years

### What's already in place

The database is closer than expected. `books` is already a canonical table with its own slugs. Reviews already link to `book_id`. `meeting_nominees` is a proper join table. The main work is:

1. Make books the primary navigation entity (UX restructuring)
2. Allow multiple meetings to reference the same `winning_book_id` (minor schema change)
3. Decouple the nomination→voting cycle from a single meeting instance
4. Introduce a `monthly_picks` or `artifact_cycles` concept that groups meetings under a book

### Dependencies

Almost every feature below benefits from this refactor. It should be done first, even if phased incrementally.

---

## Phase 1 — Foundation & Quick Wins

*Goal: Lay architectural groundwork + ship small features that immediately increase engagement for all 900 members.*

### Architecture

- [ ] **Artifacts refactor (incremental)** — Books as primary entity, meetings as instances [L-XL]
  - Step 1: Create `monthly_picks` table (month, book_id, status) to decouple from meetings
  - Step 2: Allow multiple meetings per monthly pick
  - Step 3: Migrate state machine from meetings to monthly picks
  - Step 4: Update all routes/views to navigate from books first

### Security (prerequisite for all user-input features)

- [✅] **Input sanitization** — Validate/sanitize emails, display names, reviews, and all future user inputs [M]
- [✅] **Industry standard security measures** — CSP headers, rate limiting, etc. [M]

### Engagement (small, high-impact, ships fast)

- [✅] **Spoiler tap-to-reveal** — Tapping `||spoiler||` toggles visibility [S]
- [✅] **Spoiler filter on reviews** — Hide/show reviews that contain spoilers; toggle with localStorage persistence [S]
- [✅] **Emoji reactions to reviews** — Let the 875 non-attendees participate with a single tap [S]
- [✅] **Announcements on Home page** — Admin publishes updates, gives members a reason to check in [S]
- [✅] **Improve letter grade interaction** — Replaced slider with horizontal pill strip of all 14 grades [S]
- [✅] **Changelog collapsible entries** — Latest expanded, others collapsed [S]
- [✅] **Winning book animation on Results page** — Attention-grabbing reveal when winner is displayed; consider full-screen book cover takeover [M]
- [✅] **Winning book Results page — dark mode fix** — Remove "# points" from winner card, add "Nominated by" credit, ensure readability in dark mode [S]

---

## Phase 2 — The Content Loop

*Goal: Members produce content, others respond, creating a feedback loop that makes the Home page alive.*

### Social

- [✅] **Reply to reviews** — Members can have conversations about books [M]
- [✅] **Activity feed on Home page** — Shows reviews, replies, reactions, nominations as they happen [L]
  - *Depends on: reactions and replies existing to populate the feed*
- [ ] **User-submitted discussion questions** — Members contribute questions for the current book [Future] (not sure how much value this adds now)

### Reviews & Reading

- [✅] **Streamline review page** — Lower friction to write reviews [M]
- [✅] **Text formatting buttons** — Keep markdown underneath, add toolbar on top [M]
- [ ] **Reading status per member** — Mark books as Reading, Read, DNF, Did Not Read [Future] (not sure how much value this adds now)
  - Per-member tracking with stats on the book detail page
  - No defaults — explicit opt-in
  - *Depends on: artifacts refactor (status lives on the book, not the meeting)*

### Admin Operations

- [✅] **Nomination → Voting → Winner flow** — Streamlined admin pipeline [L]
  - Create nomination form / open nominations
  - Close nominations, open voting
  - Close voting, select winner
  - Tie winner to "next" month's artifact (next as determined by the admin pipeline, not a caledar date)
- [✅] **Create meetings / link to Meetup.com** — Multiple meetings per monthly pick [M]
- [✅] **Sort and filter reviews in Admin** — Search, sort by date/grade/book [M]
- [✅] **Sort and filter users in Admin** — Search, sort by name/join date [M]
- [✅] **Promote user to Admin** — Add promote/demote action on /admin/users [S]
- [✅] **Link to profile from Admin users** — Quick link to member's public profile [S]
- [✅] **Preserve vote results as archive** — Keep past vote tallies accessible, not just the winner [M]
- [✅] **Prevent past nominations from interfering with winner URLs** — Ensure canonical slugs for winning books aren't affected by prior nomination data [S]
- [✅] **Block nominations for already-read books** — Prevent re-nomination with a gentle, warm message explaining the book was already read [S]
- [✅] **Live SSE for admin meeting detail** — Nominations appear in real-time on the admin meeting page as they come in [M]
- [✅] **Voting page UX overhaul** — Reduce card height (nominated-by + rationale make cards too big), rethink rank number placement, top-align cover with title; reference strawpoll.com for inspiration [M]
- [✅] **Admin form field icons — dark mode contrast** — Invert or brighten icons inside admin form fields so they're visible in dark mode [S]

---

## Phase 3 — Deepen the Book Experience

*Goal: Book detail pages become the richest, most engaging part of the app — worth visiting even months later.*

### Books

- [ ] **Admins Can Replace book covers** [M]
  - Fetch from online sources via ISBN
  - Upload an image to replace
  - Replace local stored version
- [ ] **Book Cover as Hero**
  - Make the Book Cover more like a hero by making it larger, even on mobile
  - Add subtle background color to section 'book-hero'
- [ ] **Tag-based filtering on History** — Tap a book's tag to filter the History grid [M]
  - Link to StoryGraph search for that tag
- [ ] **Author Page**
  - Using existing canonical URL's /author-name/ to see all the books by that author the group has read
- [ ] **Related books / Books by same author** — Cross-references on book detail pages [Future]
  - *Requires external data source (OpenLibrary API)*
- [ ] **Metadata list**
  - Improve the visual design of the Metadata.
  - Remove the Meetup.com link
  - Remove the Google Books link
  - Add a link to purchase the book from Bookshop.org (affliate link will be added later)
  - Make these buttons instead of links. Secondary style
- [ ] **Easy library check out**
  - Add a way to checkout the book from a local library
  - Admin enters local libray URL
- [ ] **Book to Book Navigation**
  - Add navigation to all Book Details pages that let users go to the Next and Previous Month's book.


### Reviews

- [ ] **Enhance spoiler filter UX** — Improve toggle placement, animation, and count badge styling after user testing [S]
- [ ] **Enhance grade pill strip** — Polish pill strip interaction based on user testing; explore haptic feedback, animation, and mobile scroll UX [S]
- [ ] **Extended markdown support** — More formatting options [M]
- [ ] **Emoji flurry for A+ books** — Celebratory animation on high-scoring book pages [S]

### My Reviews

- [ ] **Sort, Filter, Search** — Reuse patterns from History page [M]

---

## Phase 4 — Meetings & In-Person Experience

*Goal: Make the meeting itself better for attendees AND give non-attendees visibility into what happened.*

### Meetings

- [ ] **Facilitator role** — Per-meeting designation, displayed publicly [M]
  - Admin assigns facilitator
  - Facilitator gets access to guides, ice-breakers, friendly reminders
- [ ] **Club calendar view** — Visual calendar of all past and upcoming meetings [M]
- [ ] **Pull Meetup.com details** — Attendee count, rating [L]
  - Cache and refresh every 7 days
- [ ] **Meeting check-in button** — Attendees confirm presence [S]
- [ ] **Nominations page** - Users can see Nominations come in live before Voting is enabled

### Guides

- [ ] **Discussion guide with questions** [L]
  - User-submitted questions
  - Pulled from online sources
  - AI-generated options
- [ ] **Ice-breaker question generator** [M]
  - AI-generated, book-specific
  - Tone selection (light, deep, spicy)
  - Set by meeting facilitator

---

## Phase 5 — Identity & Gamification

*Goal: Members build identity within the club. Long-term engagement rewards.*

### Profiles

- [ ] **More robust profiles** — Richer member pages [L]
- [ ] **Photo upload avatars** [M]
- [ ] **Pick any DiceBear avatar** — All styles accessible via [DiceBear JS library](https://www.dicebear.com/how-to-use/js-library/) [S]
- [ ] **Create custom DiceBear avatar** — Builder UI for personalization [Future] (not enough value right now)
- [ ] **Display name collision detection** — Alert + suggest alternatives [S]
- [ ] **Usernames + display names** — Profile URLs use usernames, admin views show both [M]
- [ ] **Better UX on Profile Settings page** — Improve layout and flow [M]
- [ ] **View own public profile** — Let members see how their profile appears to others [S]

### Members

- [ ] **Public Members page** — Shows member info, stats, join date, links to profiles [L]
  - Only for logged-in users (members)

### External Integrations

- [ ] **Share a book externally** — Share link to social/messaging apps [S]
- [ ] **Invite someone to the club** — Shareable invite link [M]


## Phase 6 - UX Polish
- [ ] Update all dialogs to be rended in the client vs the current implementation of using browswer alerts/dialogs
- [ ] Update the visual design for Reaction and Reply button
  - Placement, size, hover effects
- [ ] Update book-hero section on Home
  - Add subtle background color
  - Make it larger
  - Update information hierarchy for better clarity
- [ ] Show markdown helper text when writing a Reply
- [ ] **@ Mentions**
  - Add ability to "@" mention another user
- [ ] Add pagination to Admin/Reviews, Admin/Meetings, and Admin/Users
- [ ] Make sure Nominations are limited to one per user for each Nomination cycle (unique nomination)
- [ ] 

---

## Parked Ideas

### Social
- [ ] **Custom Emoji**
  - Ability for each club to add Custom Emoji
  - Sent to Admins to approve

### Safety
I need to consider safety of users on this platform, much like any social platform. Since most clubs will meet in person, safety issues are not nearly as likely. But, it's still important.
- [ ] Allow users to block another user; per club
  - User A who Blocks User B will not see User B's Reviews, Replies, Profile. User A will still see any Nominations from User B.
  - User B who is blocked by User A will not see User A's Profile (should this also include Reviews and Replies?)

### Quotes

- [ ] **Save quotes from books** — Public or private, attributed to page number [M]
- [ ] **Random quotes on Home page** — From past books only (current book = spoilers) [S]

### Badges

Reward members for showing up, contributing, and engaging:

- [ ] **Attendance badges** [L]
  - Streak badge (consecutive meetings)
  - 10+ meetings badge
  - Perfect year (attended all meetings that year)
  - *Depends on: meeting check-in button*
- [ ] **Review badges** [L]
  - Most reviews this month
  - Highest Praise (based on high letter grades given)
  - Eternal Critic (based on low letter grades given)
- [ ] **Nomination badges** [L]
  - Most nominations per year
  - Pester 'em (nominating the same book repeatedly without it winning)
  - Kingmaker (nominations that get selected)

### Analytics
- [ ] Admins can see last login time/date for users
- [ ] Add some sort of Visitor stats (Google Analytics or something else, keep lightweight, Research first)
- [ ] Add # of Members/Users to the "About the club" section on Home, and to the About page itself
- [ ] 

### Integrations
- [ ] **StoryGraph integration** [XL]
  - Possible community API: [python api](https://github.com/ym496/storygraph-api)
  - Pull Currently Reading (up to 3)
  - Pull To-Read list (up to 5)
  - Prominent link to StoryGraph profile

Good ideas that don't justify the effort right now:

| Idea | Why it's parked |
|---|---|
| Login with Instagram/StoryGraph/GoodReads | XL effort, no stable public APIs, marginal benefit at current scale |
| Full artifact type expansion (movies, etc.) | Only needed when another club actually exists |
| User bug reporting via GitHub | A feedback form or DM is fine for now |
| Public roadmap view | Serves the builder more than the members |
| Meetup.com deep integration | Fragile API dependency, limited value vs. simple links |

---

## Page-Specific Updates

### Home Page
- [✅] Announcements section (admin-published) — Phase 1
- [✅] Live status updates — Nominations open, Voting open, and Announcements update live as meeting status changes (SSE) — Phase 2
- [✅] Activity feed (reviews, replies, reactions, nominations) — Phase 2
- [ ] Random quotes from past books — Phase 3
- [ ] Meetup.com rating in About section (cached 7 days) — Phase 4

### About Page
- [ ] Meetup.com rating (cached 7 days) — Phase 4
- [ ] Member count (cached 7 days) — Phase 4
- [ ] Visual element / hero image — Phase 4

---

## Key Dependencies

```
Input Sanitization
  └─→ Must ship BEFORE: replies, quotes, discussion questions, any new user input

Artifacts Refactor
  └─→ Unlocks: reading status, multiple meetings per book, discussion questions on books
  └─→ Enables: tag filtering, richer book detail pages

Emoji Reactions + Replies
  └─→ Required BEFORE: activity feed (needs content to populate)

Nomination → Voting → Winner Flow
  └─→ Enables: facilitator role assignment

Meeting Check-in
  └─→ Required BEFORE: attendance badges

Reviews (already shipped)
  └─→ Enables: review badges, quotes feature
```
