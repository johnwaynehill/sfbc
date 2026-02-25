# GatherBound — Brand Guidelines

→ **See [VISION.md](VISION.md)** for the product vision and platform thesis.
→ **See [PRD.md](PRD.md)** for the product specification.

---

# Brand Pyramid

This document defines the strategic, emotional, and visual foundations for GatherBound — the digital home for in-person communities built around shared cultural experiences. It serves as the single source of truth for design decisions, engineering implementation, content creation, and future product evolution.

The goal is to create a calm editorial experience that gives every member of a community a way to participate — whether or not they were in the room — and transforms shared cultural experiences into a lasting, browseable record.

---

# 1. Purpose (Why This Exists)

## Core Purpose

**The community is always bigger than the room. Give everyone a way to belong.**

Meetings are temporary. Community should not be.

In-person clubs thrive, but the room can only hold so many people. GatherBound transforms a club from something you attend into something you're part of — turning shared cultural experiences into a permanent, participatory record that grows more valuable over time.

---

# 2. Brand Belief (Worldview)

## Core Belief

Stories gain meaning when experienced together — and remembered well. Participation shouldn't require a seat.

Implications:

- The cultural artifact is the center — not the meeting, not the calendar, not the chat.
- History matters. The archive is the product.
- Identity emerges over time — for members and for the community.
- Participation doesn't require attendance. If someone has to be in the room to engage, the product has failed.
- Design should feel archival rather than disposable. Editorial, not social.

---

# 3. Brand Personality Axis

These axes prevent aesthetic drift and guide future design decisions.

## Primary Axis

ARCHIVAL ←→ PLAYFUL

Position: **Archival with quiet warmth**

- Avoid whimsical or gamified fantasy aesthetics.
- Emphasize timelessness and permanence.

## Secondary Axis

EDITORIAL ←→ TECHNICAL

Position: **Strongly Editorial**

- Interface resembles a curated publication rather than a dashboard.

## Tertiary Axis

CALM ←→ EXCITED

Position: **Calm with moments of communal energy**

- Results screens may carry subtle energy.
- Overall experience remains calm and intentional.

---

# 4. Experience Principles

## 1. Artifact Over Interface

Content dominates. Interface recedes. The cultural artifact — the book, the film, the album — is always the center.

## 2. Ritual Over Feature

Design reinforces the artifact lifecycle:

Nominate → Vote → Read → Discuss → Reflect → Archive.

The meeting is one moment in this cycle, not the whole thing.

## 3. Participation Without Attendance

Every feature asks: can someone who wasn't in the room still engage meaningfully? Reviews, reactions, discussions, reading status — these are ways to be part of the community on your own terms.

## 4. Quiet Confidence

- Minimal visual noise.
- Intentional spacing and typography.

## 5. Single Story Per Screen

Every screen answers one primary narrative question.

---

# 5. Visual Identity System

## Aesthetic Identity

**First Edition** (record.club-inspired)

Characteristics:

- Pure white canvas — content breathes, the art provides all visual color.
- Clean, content-first layout — UI chrome disappears behind the material.
- Serif headlines create editorial authority without heaviness.
- Minimal accent color — the only recurring color comes from gold star ratings and the occasional teal/amber touch inherited from the club's identity.

## Visual Archetype

- record.club — curated music/book catalog.
- Apple Books — clean editorial product.
- Independent bookstore archive.
- Literary journal.

## Color Philosophy

- Pure white (#FFFFFF) background. No warm tints, no parchment.
- Book cover imagery provides ALL visual color and energy.
- Near-zero UI color — black text, gray metadata, white surfaces.
- Gold (#F5A623) for star ratings only.
- Amber (#b45309) used sparingly for the "Currently Reading" badge and detail links — a subtle nod to club identity.
- Teal (#0f766e) used sparingly for status indicators (e.g., "Currently Reading" dot).
- Black (#000000) for primary buttons (pill-shaped CTAs).
- Subtle gray borders (#E5E5E5) and off-white (#FAFAFA) surfaces define sections without shouting.

## Typography Roles

- **DM Serif Display** — section headings, page titles, brand logotype. Editorial serif that creates quiet authority.
- **Fraunces (600–700)** — hero book title only. Bold, expressive, reserved for the single dominant artifact title.
- **Source Serif 4 (italic)** — author names and long-form review reading. Elegant and literary.
- **Inter** — body text, metadata, navigation, buttons, footer, stats. Clean, neutral, disappears behind content.
- **IBM Plex Sans** — UI badges (e.g., "CURRENTLY READING"), date metadata. Small functional labels.
- **Source Sans 3** — secondary body text (nomination banner subtitles, section links).

### Font Hierarchy Summary

| Role | Font | Weight | Size Range |
|------|------|--------|------------|
| Brand logotype | DM Serif Display | 400 | 14px |
| Section headings | DM Serif Display | 400 | 18–22px |
| Hero book title | Fraunces | 700 | 36–42px |
| Author names | Source Serif 4 | 400 italic | 15–18px |
| Body / metadata | Inter | 400–600 | 11–15px |
| UI badges / labels | IBM Plex Sans | 500 | 11–13px |
| Buttons / CTAs | Inter | 600 | 13px |
| Stats numbers | Inter | 700 | 24px |
| Navigation links | Inter | 400–500 | 12–13px |
| Secondary body / section links | Source Sans 3 | 400–500 | 13px |

## Density Model

Sparse outside, dense inside.

- Large whitespace between sections.
- Generous padding within the content column.
- Efficient information grouping within components.
- Content area padded at 20px horizontal, 24–32px vertical gaps between sections.

---

# 6. Interaction Language

## Motion Philosophy

Motion supports understanding. Never decoration.

### Motion Types

- Forward progression: gentle fade + upward movement.
- Live updates: calm organic transitions.
- Drag interactions: tactile elevation with subtle motion.

## Interaction Tone

Nominate:
- Frictionless and nearly invisible.

Vote:
- Focused, energetic, tactile.

Results:
- Communal excitement with clarity.

Book Detail:
- Reflective and artifact-focused.

---

# 7. Brand Voice

Tone:

- Intelligent
- Minimal
- Human
- Editorial

Guidelines:

- Use short direct phrases.
- Avoid marketing language.
- Avoid fantasy clichés.

Examples:

Good:
- "Nominate a book."
- "Votes counted."

Avoid:
- Promotional or exaggerated language.

---

# 8. Emotional Design Map

## Home — Welcoming + Alive

Invite exploration, communicate identity, show that the community is active. The activity feed gives members a reason to return between meetings.

## History — Archival + Discoverable

Reinforce longevity and collective memory. The archive is the most valuable thing the community owns.

## Book Detail — The Hub

Make each book feel permanent and meaningful. This is where everything lives: reviews, discussions, quotes, reading status, grade distributions. The book detail page is the center — not the meeting.

## Nominate — Fast + Frictionless

Reduce hesitation and enable rapid participation.

## Vote — Energetic + Focused

Clear ranking with tactile feedback.

## Live Results — Communal Reveal

Shared excitement without visual chaos.

## Review — Personal + Thoughtful

Encourage reflection in a calm environment. This is how the 875 members who weren't in the room participate most deeply.

## Activity Feed — Community Pulse

A structured stream of reviews, reactions, replies, and nominations. Editorial, not social — curated updates, not an endless scroll.

## Member Profiles — Identity Over Time

Reinforce personal contribution. Reading history, reviews, badges, and community engagement build identity within the group.

## Admin — Confident + Efficient

Operational clarity with minimal decoration. Running the club through the app must be easier than a spreadsheet.

---

# 9. Decision Filters (Brand Guardrails)

When unsure about a design decision, ask:

1. Does this make the cultural artifact feel more like the center?
2. Does this increase calm or add noise?
3. Would this fit on record.club or in an independent bookstore archive?
4. Does this introduce "app energy" instead of editorial energy?
5. Is the UI disappearing behind the content, or competing with it?
6. Can a member who never attends a meeting still engage meaningfully with this?
7. Does this add to the permanent record, or is it disposable?

If the answer conflicts with these principles, reject the change.

---

# 10. Brand Summary Statement

GatherBound is the digital home for in-person communities built around shared cultural experiences. It follows the **First Edition** design system — a clean editorial aesthetic inspired by record.club — that transforms the community from something you attend into something you belong to. The cultural artifact is the center. The archive grows more valuable over time. Participation doesn't require a seat. The interface recedes; the artifacts and the community are the design.

---

End of Brand Guidelines.

