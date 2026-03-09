# GatherBound — Backlog

Prioritized items for sprint planning. Organized by Epic, sized (S/M/L), and prioritized.

> **Priority key:** P0 = next sprint candidates, P1 = near-term, P2 = future
>
> Each item references which [Roadmap milestone](ROADMAP.md) it serves.
> Completed items move to [SHIPPED.md](SHIPPED.md).

---

## Book Experience
*Roadmap: Milestone 1 — The Book Page is the Destination*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | M | Admin can replace book covers | Fetch by ISBN or upload image; replace local stored version |
| P2 | M | Tag-based filtering on History | Tap a tag → filter the grid; link to StoryGraph for that tag. ~30 books — search covers this until archive grows past 60. |
| P2 | M | Author page | `/books/:authorSlug/` showing all books by that author. Not enough repeat authors yet to justify the route. |
| P2 | S | Easy library checkout link | Admin enters local library URL; shown in metadata |

## Reviews

*Roadmap: Milestone 1 — The Book Page is the Destination*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | M | Extended markdown support | Additional formatting options beyond current set |
| P2 | S | Emoji flurry for A+ books | Celebratory animation on high-scoring book pages |

## Profiles & Identity

*Roadmap: Milestone 2 — Every Member Belongs*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | M | Better profile settings UX | Improve layout and flow of settings page |
| P1 | L | Public members page | Browsable member directory (logged-in users only) |
| P1 | S | Display name collision detection | Alert + suggest alternatives on signup |
| P1 | M | Usernames + display names | Profile URLs use usernames; admin views show both |
| P2 | L | More robust profiles | Richer member pages with stats, favorites, reading history |
| P2 | M | Photo upload avatars | Alongside existing DiceBear options |
| P2 | S | Pick any DiceBear avatar | All styles via DiceBear JS library (currently 24 of many) |

## Social & Community

*Roadmap: Milestone 1 (P0 items) + Milestone 2*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | M | Invite someone to the club | Shareable invite link |
| P2 | L | Reading status per member | Reading, Read, DNF, Did Not Read — per-member tracking |
| P2 | M | User-submitted discussion questions | Members contribute questions for the current book |

## Admin & Operations

*Roadmap: Milestone 1 + 3*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | M | Admin pagination | Paginate reviews, picks, and users lists |
| P1 | M | Remove Meeting information from Pick | Allows Picks to have multiple meetings per cycle |
| P2 | M | Allow for creation of meeting for a Pick | Multiple meetings per Pick allow for more people to meet in-person | 

## Meetings & In-Person

*Roadmap: Milestone 3 — The Meeting Gets Better*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P2 | M | Facilitator role | Per-meeting designation; access to guides and tools |
| P2 | M | Club calendar view | Visual calendar of past and upcoming meetings |
| P2 | L | Meetup.com data pull | Attendee count, rating — cached weekly |
| P2 | S | Meeting check-in button | Attendees confirm presence, counts at both Pick level and Meeting level. Displays number of in-person people on Pick (Book) Detail pages. |
| P2 | L | Discussion guide with questions | User-submitted, sourced, AI-generated |
| P2 | M | Ice-breaker question generator | AI-generated, book-specific, tone selection |

## UX Polish

*Roadmap: Milestone 4 — Polish & Platform*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| P1 | S | Reaction and reply button design | Placement, size, hover effects update |
| P2 | M | @ mentions | Mention another user in replies |
| P2 | S | Coming Up section — enlarge covers | Larger book covers and more vertical space |
| P2 | M | Add haptics on key interactions for mobile users | https://haptics.lochie.me/ |

## Bugs

*See also [Bugs.md](Bugs.md) for field-reported issues.*

| Priority | Size | Item | Notes |
|----------|------|------|-------|
| — | — | *No open P1 bugs* | — |

---

## Sprint History

| Sprint | Focus | Key Items |
|--------|-------|-----------|
| 1 | Schema migration | `monthly_picks` table, read-side swap |
| 2 | State machine | Lifecycle migrated from meetings to picks |
| 3 | Route migration | Public routes + admin UI on picks |
| 4 | Lifecycle reorder | Scheduled status, event tracking |
| 5 | Quick wins + bugs | Metadata cleanup, book nav, my-reviews filter, toggle, --amber fix |
| 6 | Book page as destination | Immersive hero, CTA buttons, inline metadata, external links, share, login prompts, nomination search + edit, rationale display |
| 7 | Reviews polish + metadata | DNF checkbox + badge, spoiler filter polish, grade axis tooltips, reply markdown helper, publisher/language metadata, Samsung light mode fix, migration FK safeguard |
| 8 | Community & polish | Community stats on Home, view own profile link, masked admin emails, styled dialog modals, home hero redesign |
