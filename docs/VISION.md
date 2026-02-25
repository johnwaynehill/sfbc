# GatherBound

## The digital home for in-person communities.

---

## The Insight

In-person clubs are thriving. Book clubs, film societies, running groups, wine circles, tabletop nights — they're everywhere, and Meetup alone lists millions of them. But there's a brutal math problem at the center of every successful one:

**The community is always bigger than the room.**

Our own book club has 900+ members on Meetup. Meetings cap at 25. A core group of 8-10 always attends, which means the vast majority of members rarely — or never — get a seat. They signed up because they care about books. They want to participate. But showing up to a meeting is the only way to engage, and most people can't.

This isn't unique to us. It's structural. Every in-person club that grows beyond its room size faces the same problem: the community outgrows the format, and there's no tool that bridges the gap.

---

## The Gap

**Meetup** handles discovery and logistics — it gets people in the door. But it provides zero engagement between events. Once you RSVP (or don't), there's nothing to do.

**Discord / Slack / GroupMe** handle chat — but chat is ephemeral, unstructured, and overwhelming. A discussion about Chapter 3 disappears in a flood of memes and scheduling messages. Nothing is preserved. Nothing is browseable. There's no record.

**Goodreads / StoryGraph / Letterboxd** handle personal tracking — but they're individual tools, not community tools. They don't know your club exists.

**Nothing** handles structured community engagement around a shared cultural experience. No tool says: here's what we're reading this month, here's what everyone thought, here's the discussion, here's the archive of everything we've ever done together — and you can participate whether or not you were in the room.

---

## The Product

GatherBound is the digital home for in-person communities built around shared cultural experiences.

The core model: **the cultural artifact is the center.** For a book club, that's the book. For a film society, the film. For a wine circle, the bottle. The artifact is what the community gathers around. Meetings are instances — ways to experience the artifact together — but the artifact page is the permanent hub where everything lives: reviews, discussions, quotes, reading status, grades, reactions.

This changes who can participate and how:

- **Members who attend a meeting** nominate, vote, discuss in person, and review afterward.
- **Members who can't attend** read along, write reviews, react to others' reviews, join discussion threads, save quotes, track their reading status. They experience the same artifact on the same timeline — they just aren't in the room.
- **The organizer** manages the cycle (nominations, voting, winner selection, meeting scheduling) through a streamlined admin flow, and can run multiple meeting sessions per artifact to serve more people.
- **The archive** grows month over month into a browseable, shareable record of everything the community has experienced together.

The app doesn't replace the meeting. It makes the meeting just one way to participate in something bigger.

---

## Why This Works

### For members who can't get a seat
The app IS the club. They read along, see what others think, react, discuss, build an identity within the community. They go from "I'm on a Meetup waitlist" to "I'm a member of this book club."

### For members who attend
The meeting gets better. They arrive having seen the discussion threads, the reading progress of others, the emerging consensus. The in-person conversation is richer because the online conversation happened first. And after the meeting, their reviews and reactions persist as part of the permanent record.

### For organizers
Running the club gets dramatically easier. The nomination-to-voting-to-winner pipeline is built in. Multiple meetings per book means more people served without more admin overhead. Announcements, discussion guides, facilitator tools — all in one place.

### For the community over time
The archive becomes the most valuable thing the club owns. Three years of books, reviews, grades, quotes, discussions — browseable, searchable, shareable. New members can see everything the club has read and what people thought. The history reinforces identity: this is who we are, this is what we've done.

---

## The Platform Thesis

Every in-person club built around a shared cultural artifact has the same needs:

1. **A selection cycle** — nominate, vote, choose what's next
2. **A shared experience** — everyone engages with the same artifact on the same timeline
3. **Structured reflection** — reviews, grades, ratings, reactions
4. **Community discussion** — conversation about the artifact, not logistics
5. **A permanent archive** — a growing record of shared experience

Book clubs. Film societies. Album-of-the-month clubs. Podcast clubs. Wine tasting groups. Manga circles. The artifact type changes. The community pattern doesn't.

GatherBound starts with book clubs — because that's where we have a working product, real users, and a deep understanding of the problem. But the artifact-centered architecture is designed to generalize. A book, a film, and an album are all cultural artifacts with the same structural needs: a detail page, a review system, a selection cycle, and a community around them.

---

## What Exists Today

We have a working app ([sf-book-club.fly.dev](https://sf-book-club.fly.dev)) serving the SF Fantasy & Sci-Fi Book Club. It handles:

- QR-based nominations and ranked voting (in person, no login required)
- Live real-time results via SSE
- Letter-grade reviews (F through S) with markdown support and spoiler tags
- A browseable archive of 30+ books with covers, metadata, and grade distributions
- Magic-link + password authentication
- Public member profiles with DiceBear avatars
- Dark mode, mobile-first responsive design
- Admin panel with full meeting lifecycle management

The foundation is solid. The architecture already treats books as canonical entities with their own slugs and URLs. Reviews already link to books, not meetings. The editorial "permanent cultural artifact" aesthetic is established.

What's missing is everything that transforms it from a tool for 25 meeting attendees into a community platform for 900 members — and eventually, a platform for thousands of clubs.

---

## First Principles

1. **The artifact is the center.** Not the meeting. Not the calendar. Not the chat. The thing you gather around is the organizing principle.

2. **Participation doesn't require attendance.** If someone has to be in the room to engage with the club, the app has failed.

3. **The archive is the product.** Every month adds to something that grows more valuable over time. A living record beats a disposable tool.

4. **Editorial, not social.** The experience should feel curated and meaningful, like a publication — not like a feed. Structure over stream. Record.club, not Reddit.

5. **In-person is sacred.** The app amplifies the meeting, never replaces it. Being in the room should still feel special. The app makes it possible for everyone else to participate in their own way.

6. **Organizers are users too.** If running the club through the app is harder than a spreadsheet, organizers won't do it. The admin experience must be as considered as the member experience.

---

## What's Next

See [PRD.md](PRD.md) for the current product specification — pages, features, functional requirements, and technical architecture.

See [ROADMAP.md](ROADMAP.md) for the phased feature plan — what we're building and in what order, starting with the artifacts-as-center refactor that unlocks everything else.
