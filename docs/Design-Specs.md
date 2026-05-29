SF Fantasy & Sci-Fi Book Club App

## Design Specifications

This document defines the complete visual and interaction system for the app. It is the authoritative reference for all design implementation decisions.

Read this alongside:
- **VISION.md** — product vision, market thesis, and platform strategy
- **PRD.md** — product specification, goals, user stories, page definitions, functional requirements
- **Brand-Guidelines.md** — strategic brand foundations and emotional design map
- **Design-Thinking.md** — implementation guidance for engineers and AI tools
- **Tech-Specs.md** — data model, routes, APIs, rendering, and infrastructure

---

# 1. Aesthetic Lock — First Edition (record.club-inspired)

To ensure implementation tools (including Codex) produce a cohesive and visually strong result, the product adopts a single locked aesthetic direction for v1.

**Aesthetic Name**
First Edition — a clean editorial aesthetic directly inspired by record.club.

**Core Vibe**
* Pure white canvas. No warm tints, no parchment texture.
* Content-first — book covers provide ALL visual color and energy.
* Serif headlines (DM Serif Display) create editorial authority without heaviness.
* Near-zero UI color — black text, gray metadata, subtle gray borders.
* Black pill-shaped CTA buttons. Gold star ratings. Minimal accent color.
* The UI disappears; the books and community reviews are the design.

**Non-Negotiables**
* One cohesive aesthetic across public, admin, and QR flows.
* Dark mode support: system preference detection (`prefers-color-scheme`) + manual toggle via persistent `data-theme` attribute. Both light and dark themes maintain the First Edition editorial feel.
* Use only approved typography tokens and color tokens.
* Follow "Sparse outside, dense inside" density model.
* Light mode: Pure white (#FFFFFF) background. Dark mode: near-black (#111111) background. Both modes let book cover imagery provide visual energy.

---

# 2. Overall Design Philosophy

* Clean editorial archive — inspired by record.club, Apple Books, and independent bookstore catalogs.
* Pure white canvas; book cover art provides all visual color and energy.
* Minimal UI chrome — the interface recedes; content dominates.
* Serif headlines create editorial authority; sans-serif body text disappears behind the content.
* Near-zero UI color — black text, gray metadata, white surfaces, gold star ratings.
* Fantasy/sci-fi tone comes from content (book covers, titles) and subtle amber/teal accents, never themed decoration.

---

# 3. Typography System

Design Goals:

* Strong typographic hierarchy with distinct roles per font family.
* Readable long-form text for reviews (Source Serif 4 italic).
* Editorial presence for titles and headings (DM Serif Display, Fraunces).
* Clean, neutral UI text that disappears behind content (Inter, IBM Plex Sans).

---

# 4. Layout & Spacing Principles

* Mobile-first layout with responsive scaling.
* Generous whitespace between sections.
* Constrained content width for readability.
* Vertical rhythm preferred over dense grid layouts.
* Card-based presentation for collections (History grid, nominees, etc.).

Interaction Layout Rules:

* One primary action per screen whenever possible.
* Focus-mode layouts for nomination and voting flows.
* Avoid sidebars on mobile; use stacked content blocks.

---

# 5. Visual North Star (Editorial Composition Target)

The following visual reference represents the intended editorial composition and emotional tone for the application.

This is NOT a literal UI spec or pixel-perfect layout.
It is a reference for:

- composition hierarchy
- content dominance
- spacing rhythm
- editorial tone
- interaction calmness.

Use references in /inspiration

### Core Characteristics to Preserve

1. Content Dominance
   - One primary subject visually anchors the page (BookHero).
   - Supporting elements visually defer.

2. Editorial Calmness
   - Generous whitespace.
   - Minimal visual noise.
   - Navigation is quiet, never dominant.

3. Hierarchical Flow
   - Hero → Context → Primary Action → Exploration.
   - Users understand the page within one viewport.

4. First Edition Aesthetic
   - Pure white (#FFFFFF) background — no warm tints, no parchment.
   - Book cover imagery provides ALL visual color.
   - Near-zero UI color — black text, gray metadata, white surfaces.
   - Gold (#F5A623) for star ratings only.

5. Record.club Inspiration
   - Editorial layout rather than dashboard layout.
   - Visual pacing prioritized over density.
   - The UI disappears behind the content.

### Implementation Rule

When design decisions are unclear:

- Prefer alignment with this visual reference over generic UI conventions.
- Avoid introducing dashboard-like layouts or equal-weight grids.

This reference defines the experiential target for v1.

---

# 6. Design Tokens (MVP Implementation Guidance)

To ensure consistent visual output (especially when generated or extended by AI tools like Codex), the UI should use a small, explicit set of design tokens. New components require extending canonical component list.

### Typography Tokens

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

### Layout Tokens

* Max content width: 860px.
* Border radius: --radius-sm: 4px, --radius-md: 8px, --radius-lg: 100px (pill).
* Card padding: 16–24px.
* Grid gap default: 16px.
* Content gutter: 20px horizontal.

### Color Tokens (Conceptual Guidance)

* Background: pure white (#FFFFFF) — no warm tints.
* Primary text: black (#000000) for maximum contrast.
* Secondary text: medium gray (#666666) for body, metadata.
* Tertiary text: light gray (#999999) for footer, placeholders.
* Star ratings: gold (#F5A623) — the only recurring color accent.
* Detail links: amber (#b45309) — sparingly, a nod to club identity.
* Status indicators: teal (#0f766e) — sparingly, for "Currently Reading" dot.
* CTAs: black (#000000) background, white text, pill-shaped (100px radius).
* Surfaces: off-white (#FAFAFA) for subtle section differentiation.
* Borders: light gray (#E5E5E5) at 1px — quiet section separation.

#### Purpose
* Prevent inconsistent spacing or default browser styling.
* Provide clear implementation guardrails without prescribing exact visual branding.

#### Executable Design System (Codex Must Follow)
This converts visual intent into implementation rules so AI tools do not guess styling decisions.

**Fonts** (NO substitutions)

Section headings, brand logotype:
* DM Serif Display (400)

Hero book title ONLY:
* Fraunces (600–700)

Author names, long-form review reading:
* Source Serif 4 (400 italic)

Body text, metadata, navigation, buttons, footer, stats:
* Inter (400–700)

UI badges (e.g., "CURRENTLY READING"), date metadata:
* IBM Plex Sans (500)

Secondary body text (nomination subtitles, section links):
* Source Sans 3 (400–500)

**Never use**
* system-ui
* Roboto
* Arial
* default browser fonts

**Color Tokens (css) — Light Mode (default)**
:root {
  /* Backgrounds */
  --bg: #FFFFFF;
  --surface: #FAFAFA;
  --surface2: #F0F0F0;

  /* Text */
  --text: #000000;
  --text2: #666666;
  --text3: #999999;

  /* Borders */
  --border: #E5E5E5;
  --border2: #F0F0F0;

  /* Accents (use sparingly) */
  --accent: #b45309;    /* amber — detail links, club identity nod */
  --accent2: #0f766e;   /* teal — status dots (e.g., "Currently Reading") */
  --star: #F5A623;      /* gold — star ratings only */
  --danger: #b91c1c;

  /* CTA */
  --cta-bg: #000000;
  --cta-text: #FFFFFF;

  /* Elevation */
  --shadow: 0 2px 8px rgba(0,0,0,0.06);

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 100px;   /* pill shape for CTAs */

  /* Layout */
  --maxw: 860px;
  --gutter: 20px;

  /* Spacing scale */
  --s-1: 8px;
  --s-2: 12px;
  --s-3: 16px;
  --s-4: 24px;
  --s-5: 32px;
  --s-6: 48px;
  --s-7: 72px;
}

**Dark Mode Overrides**
Applied via `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and `[data-theme="dark"]`:
  --bg: #111111;
  --surface: #1a1a1a;
  --surface2: #222222;
  --text: #e8e8e8;
  --text2: #a0a0a0;
  --text3: #6a6a6a;
  --border: #2a2a2a;
  --border2: #222222;
  --cta-bg: #e8e8e8;
  --cta-text: #111111;
  --shadow: 0 2px 8px rgba(0,0,0,0.3);

Dark mode implementation uses a dual-selector pattern for both OS preference detection and manual toggle. A FOUC-prevention script in the `<head>` reads `localStorage('theme')` and sets `data-theme` before first paint. The theme toggle button persists choice to localStorage.

**Background Treatment**
* Pure white (#FFFFFF) — NO texture, NO grain, NO noise overlay.
* Book cover imagery provides all visual color and energy.
* Subtle #FAFAFA surface blocks define sections without additional decoration.

**Layout Constraints**
* Single centered content column (max-width var(--maxw)).
* Edge-to-edge hero allowed; text remains constrained.
* Above-the-fold shows:
  * Hero
  * Context
  * ONE primary action.

---

# 7. Component Styling Rules

**Cards**
* background: var(--surface) or #FFFFFF
* border: 1px solid var(--border)
* radius: var(--radius-md) (8px)
* shadow: var(--shadow) for cover art wrappers

**Buttons**
* Primary = black pill (background: var(--cta-bg), color: var(--cta-text), border-radius: var(--radius-lg))
* Secondary = outline (border: 1px solid var(--border), background transparent)
* Quiet = text only.

**Links**
* Detail links: var(--accent) amber color.
* Section links: var(--text2) gray, Source Sans 3.
* Underline on hover only.

**Motion**
* 150–220ms transitions.
* Calm editorial motion only.
* Respect prefers-reduced-motion.

---

# 8. Typography Guidelines

* Brand logotype and section headings: DM Serif Display (400). Creates editorial authority.
* Hero book title ONLY: Fraunces (700). Bold, expressive, reserved for the single dominant artifact title.
* Author names and long-form review reading: Source Serif 4 (400 italic). Elegant and literary.
* Body text, metadata, navigation, buttons, stats: Inter (400–700). Clean, neutral, disappears behind content.
* UI badges and date metadata: IBM Plex Sans (500). Small functional labels.
* Secondary body text (nomination subtitles, section links): Source Sans 3 (400–500).
* Maintain hierarchy: Hero Title (Fraunces) → Section Heading (DM Serif) → Body (Inter) → Meta (IBM Plex Sans).

---

# 9. Visual Scale & Rhythm

### Visual Scale Ratio
Hero-level elements should be visually 2–3x larger than surrounding content blocks. Hero should visually occupy ~40–60% of first viewport height.

**Examples**
- BookHero cover size approx 240–320px height on mobile.
- H1 title visually dominant within first viewport.
- Section titles never compete with Hero weight.

### Vertical Rhythm
Each page follows:
* Hero → spacing var(--s-6)
* Context → spacing var(--s-5)
* Primary CTA → spacing var(--s-6)
* Exploration sections separated by var(--s-7)

Avoid stacking multiple sections without breathing space.

### Surface Depth Rules
Depth Level 1:
- Pure white (#FFFFFF) page background.

Depth Level 2:
- Off-white (#FAFAFA) section blocks (nomination banner, footer, cover wrappers).

Depth Level 3:
- Cards with 1px border (#E5E5E5) and subtle shadow (0 2px 8px rgba(0,0,0,0.06)).

Never nest cards inside cards unless explicitly required.

---

# 10. Content Dominance (Editorial Composition Rule)

Each page must have ONE dominant visual subject.

The dominant object receives:
- Largest visual scale.
- Strongest visual weight.
- Most whitespace surrounding it.
- First placement in attention flow.

Supporting elements must visually defer using:
- smaller scale
- lighter typography
- reduced contrast
- increased spacing.

Never design pages where multiple elements compete equally for attention.

**Page dominance examples**
Home:
- Dominant = current book hero.

Book Detail:
- Dominant = book hero (cover + title).

History:
- Dominant = collection grid (not navigation or filters).

Vote:
- Dominant = ranked ballot list.

Results:
- Dominant = results visualization.

---

# 11. Color System Guidance

* Light mode: Pure white (#FFFFFF) background. Dark mode: near-black (#111111) background.
* Book cover imagery provides ALL visual color and energy to the interface in both modes.
* Near-zero UI color: high-contrast text, gray metadata, neutral surfaces.
* Gold (#F5A623) for star ratings only — the one consistent accent.
* Amber (#b45309) used sparingly for detail links — a subtle nod to club identity.
* Teal (#0f766e) used sparingly for status indicators (e.g., "Currently Reading" dot).
* CTAs: black background in light mode, light background in dark mode (pill-shaped buttons).
* Subtle borders and surface blocks define sections without shouting.
* Grade badges use distinct gradient backgrounds per tier: S=gold (3-stop premium gradient), A=emerald, B=blue, C=warm stone, D=orange, F=red. Dark mode uses translucent versions.
* Avoid overly saturated or "themed" fantasy palettes that reduce readability.
* All text colors must pass WCAG AA accessibility mandates against their respective mode backgrounds.

---

# 12. Motion & Interaction Tone

* Subtle transitions (approx. 150–250ms).
* Motion used for feedback, not decoration.
* Avoid flashy or distracting animations.
* Emphasize calm, responsive interactions.

---

# 13. Motion Language Spec (Implementation Guidance)

Motion should reinforce clarity, spatial understanding, and emotional tone rather than drawing attention to itself. The goal is a calm, premium editorial feel — similar to modern reading apps or curated media platforms.

### Core Principles

* Motion communicates cause and effect.
* Motion should make state changes feel natural and predictable.
* Prefer fewer, consistent motion patterns rather than many unique animations.
* Motion should never delay primary task completion.

### Primary Motion Patterns

#### 1. Forward Progression Motion

Used when moving through primary flows (Nominate → Results, Vote → Results, Review → Confirmation).

Guidelines:

* Subtle fade + upward or forward transition.
* Duration: 150–200ms.
* Avoid dramatic page slides or heavy parallax.

Purpose:

* Reinforce feeling of progression through a narrative journey.

#### 2. State Change Feedback

Used for submission, success states, or updates.

Examples:

* Button transitions to loading state.
* Inline success confirmation fades in.
* Toast appears briefly with gentle motion.

Guidelines:

* Motion originates near the interaction point.
* Keep animation distance small and intentional.

#### 3. Live Data Motion (Results Page)

Used for live vote updates.

Examples:

* Bar chart height animates smoothly when scores change.
* Vote counter increments with subtle numeric transition.

Rules:

* Avoid sudden jumps or flashes.
* Use easing that feels calm and organic.

#### 4. Drag Interaction Motion (Ranked Ballot)

Used when reordering nominees.

Guidelines:

* Dragged item elevates slightly (shadow/scale).
* Other items smoothly shift to indicate new position.
* Release snaps gently into place.

Purpose:

* Make ranking feel tactile and understandable on mobile.

### Motion Constraints

* Avoid long animations (>300ms) for primary flows.
* Avoid animations that block interaction.
* Motion should degrade gracefully if reduced-motion settings are enabled.

### Accessibility

* Respect prefers-reduced-motion media query.
* Provide non-animated alternatives for essential state feedback.

Design Principle:

"Motion supports understanding — it should never compete with content."

---

# 14. Visual Density Strategy

The interface should intentionally balance two density modes to achieve a calm, editorial, premium feel.

### Macro Sparse Layout (Page-Level)

* Large vertical spacing between major sections.
* Clear visual separation between content areas.
* Editorial pacing similar to magazine layouts.
* Avoid stacking too many elements without breathing room.

### Micro Dense Components (Within Sections)

* Compact information grouping inside cards, lists, and metadata panels.
* Efficient presentation of book details, rankings, and review content.
* Allow users to scan quickly without excessive scrolling.

Design Principle:

"Sparse outside, dense inside." Macro layout provides calmness; micro layout provides usability and efficiency.

---

# 15. Editorial Layout Patterns (Structural Composition)

### Object Dominance Principle

Primary artifact content (e.g., book cover and title) should visually anchor each page. Layout should reinforce the feeling that the book is the central object rather than surrounding UI.

Guidelines:

* Each page should have one dominant visual object.
* Supporting metadata and actions should follow the object rather than precede it.
* Avoid placing primary actions above the object unless in fast-tempo task flows (Nominate/Vote).
* Book covers and titles should receive consistent visual prominence across pages.

Purpose:

* Maintain editorial calmness.
* Reinforce cultural artifact framing.
* Prevent UI drift toward dashboard-style layouts.

---

To ensure a calm, modern, editorial feel inspired by record.club, the following layout patterns should guide page structure. These patterns define composition rather than visual styling and help maintain consistency across all screens.

### 1. Hero → Context → Action Pattern

Structure:

* HERO: Large visual anchor (book cover, results visualization, or primary identity element).
* CONTEXT: Supporting metadata and explanatory information.
* ACTION: Clear primary CTA (Nominate, Vote, View Results, Review, etc.).

Design Intent:

* Users first recognize visually, then understand context, then act.

### 2. Edge-to-Edge Anchor + Constrained Content

* Hero or visual anchors may extend wider to create strong visual hierarchy.
* Reading content and text blocks should remain within a constrained max-width column for readability.
* Creates cinematic feel while preserving editorial clarity.

### 3. Gallery Strip Pattern (Horizontal Exploration)

* Horizontal scrollable rows for browsing collections (e.g., History preview, future curated lists).
* Cards maintain consistent height and aspect ratio.
* Encourages discovery without excessive vertical scrolling.

Design Principle:

Each page should typically include:

* One visual anchor (hero)
* One primary action
* One exploration area.

---

# 16. Mobile Grid System

The interface should follow a simple editorial mobile grid system to ensure consistency, spacing clarity, and predictable responsive behavior.

### Single Primary Content Column

* Default to one centered content column.
* Maintain constrained readable width (~680px–820px max on large screens).
* Avoid complex multi-column layouts for primary reading flows.

### Spacing Scale

Use consistent spacing increments (8pt scale):

* 8px
* 16px
* 24px
* 32px
* 48px
* 64px
* 96px (major section separation)

### Section Rhythm (Macro Density Control)

* Mobile section padding: ~32–48px vertical.
* Desktop section padding: ~64–96px vertical.
* Maintain strong vertical rhythm across pages.

### Card Grid Rules

For book collections:

* Mobile: 2-column grid.
* Tablet: 3-column grid.
* Desktop: 4–6 column grid.
* Maintain consistent book cover aspect ratio (2:3).

### Gallery Strip Guidelines

* Card width approx. 120–160px on mobile.
* 16px gaps between cards.
* Enable snap scrolling for smooth browsing.

### Alignment Rule

* Macro layout centered.
* Internal content left-aligned for readability.

---

# 17. Interaction Hierarchy Ladder

The interface should follow a clear hierarchy of interaction importance to maintain calm, editorial clarity and prevent visual clutter. Every UI element should belong to one of the following levels:

### Level 1 — Primary Anchor (Hero)

* Emotional and visual focus of the page.
* Typically large book cover, results visualization, or primary identity element.
* Highest visual weight but not interaction-heavy.

### Level 2 — Primary Action

* One primary CTA per page whenever possible (e.g., Nominate, Vote, Submit Review).
* Visually obvious but secondary to the hero in scale.

### Level 3 — Supporting Context

* Metadata or explanatory information that supports understanding.
* Examples: meeting details, instructions, book metadata.
* Visually quieter than primary elements.

### Level 4 — Exploration / Secondary Content

* Browsing areas such as history strips, review lists, or related content.
* Should not visually compete with the hero or primary action.

### Level 5 — Background Metadata

* Low-priority information such as timestamps, secondary links, or admin indicators.
* Smaller typography and reduced visual emphasis.

Design Principle:

* Each page should clearly communicate one primary anchor, one primary action, and optional exploration areas.
* Visual spacing should reinforce hierarchy: higher levels receive more whitespace and prominence.

---

# 18. Editorial Friction Principle

Primary actions should minimize friction for speed and clarity, while editorial browsing surfaces intentionally introduce gentle pacing to create a calm, curated experience.

### Low-Friction Zones (Task Flows)

* Nomination flow
* Voting flow
* Primary CTAs

Design Goals:

* Fast completion
* Minimal distractions
* Tight spacing and clear progression

### Gentle Editorial Friction (Browsing & Artifact Pages)

* Book Detail pages
* History browsing
* Home hero sections

Design Techniques:

* Generous whitespace
* Larger visual anchors (book covers)
* Progressive disclosure of information
* Reduced control density

Purpose:

* Encourage slower, more intentional browsing.
* Reinforce the feeling that book pages are cultural artifacts rather than utility screens.

Design Principle:

"Task flows remove friction. Editorial surfaces introduce pacing."

---

# 19. Content Weighting Model (Visual Hierarchy Scaling)

To maintain long-term visual consistency and prevent layout drift as features evolve, the interface should follow a predictable content weighting model. This defines how visually "heavy" different elements should feel relative to each other.

Purpose:

* Ensure pages feel intentional rather than assembled.
* Help engineers and AI tools choose appropriate sizes, spacing, and emphasis without guessing.
* Maintain editorial hierarchy even as new components are added.

### Weight Levels

#### Level A — Primary Artifact (Hero Weight)

Examples:

* Current book hero
* Book cover on detail page
* Results visualization

Rules:

* Largest visual element on the screen.
* Receives the most whitespace around it.
* Typically appears near the top of the layout.

#### Level B — Primary Action Weight

Examples:

* Nominate button
* Submit Vote button
* Submit Review button

Rules:

* Clearly visible but visually lighter than Level A.
* High contrast for discoverability.
* Avoid multiple competing Level B elements.

#### Level C — Supporting Context Weight

Examples:

* Metadata panels
* Instructions text
* Meeting details

Rules:

* Medium visual prominence.
* Supports understanding without competing for attention.

#### Level D — Exploration Content Weight

Examples:

* History grids
* Review lists
* Horizontal gallery strips

Rules:

* Visually consistent patterns.
* Slightly denser layouts acceptable.
* Should not overpower Level A or B elements.

#### Level E — Background Metadata Weight

Examples:

* Secondary links
* Timestamps
* Admin indicators

Rules:

* Smaller typography and reduced contrast.
* Present but visually quiet.

### Design Principle

"Visual weight communicates importance." Layout, spacing, and scale should reinforce hierarchy rather than relying on color or decoration alone.

---

# 20. Navigation Gravity Model

Navigation should remain static, minimal, and predictable. Primary movement through the product should be driven by content hierarchy, visual anchors, and contextual calls-to-action rather than navigation menus.

Core Principle:

"Navigation confirms movement — content creates movement."

### Gravity Levels

#### Level 1 — Strong Gravity (Primary Flow)

Users should feel naturally pulled forward through primary actions and layout hierarchy.

Examples:

* Home → Nominate / Vote CTA
* Vote → Live Results
* Results → Book Detail

Design Techniques:

* Strong visual anchors
* Clear spatial flow (top-to-bottom progression)
* Prominent but singular CTAs

#### Level 2 — Medium Gravity (Contextual Navigation)

Supporting pathways that provide depth without competing for attention.

Examples:

* Book cover → Book Detail page
* Review summary → Full reviews
* External resource links

Guidelines:

* Visually secondary to primary flow.
* Integrated into content rather than separated into menus.

#### Level 3 — Weak Gravity (Global Navigation)

Static navigation exists primarily as a safety net rather than a primary driver.

Examples:

* Home
* History
* My Reviews

Design Rules:

* Visually quiet.
* Consistent placement.
* Avoid dynamic restructuring that increases cognitive load.

Purpose:

* Maintain editorial calmness.
* Prevent dashboard-style navigation complexity.
* Allow pages themselves to guide user progression.

---

# 21. Attention Flow Model (Editorial Layout Guidance)

The interface should guide user attention through predictable visual pathways. Layout, spacing, and hierarchy should direct eye movement naturally rather than relying on heavy visual decoration or complex navigation.

Design Principle:

"Users should instinctively know where to look next."

### Primary Attention Path

Most screens should follow a natural editorial flow:

1. **Visual Anchor (Hero / Primary Artifact)**

   * Largest visual element.
   * Immediately communicates context.
   * Examples: Book hero, results chart.

2. **Meaning Context**

   * Supporting metadata and explanation.
   * Examples: meeting date, instructions, author info.

3. **Primary Action**

   * Clear next step (Nominate, Vote, Submit Review).

4. **Exploration Area**

   * Secondary browsing content (history grid, reviews).

### F-Pattern Reading Alignment

Because most users scan vertically:

* Primary elements aligned left within constrained column.
* Avoid centered long-form text blocks.
* Left alignment supports faster scanning and readability.

### Visual Rest Zones

Not every area should compete for attention.

Guidelines:

* Leave whitespace between major sections.
* Avoid placing competing CTAs near the primary action.
* Allow hero sections to breathe.

Purpose:

* Reduce cognitive fatigue.
* Reinforce editorial calmness.

### CTA Gravity Placement

Primary CTAs should appear:

* Immediately after contextual understanding.
* Not before users understand what they are acting on.

Examples:

* Home: hero → meeting info → CTA.
* Vote: instruction → ballot → submit.

### Secondary Attention Loops

Some elements create optional engagement loops:

Examples:

* Book cover → Book Detail.
* Review summary → full reviews.

Rules:

* Secondary loops should never interrupt the main attention path.

### Anti-Patterns to Avoid

* Multiple equal-sized visual anchors competing.
* Large blocks of centered content.
* Dense clusters of buttons at top of page.
* Dynamic layout shifts that break eye flow.

---

# 22. Single Story Per Screen Rule

Each screen should communicate one clear narrative purpose. Users should be able to describe what a page is "about" in a single sentence.

Guidelines:

* One dominant visual anchor per page.
* One primary action whenever possible.
* Supporting elements reinforce the main narrative rather than competing with it.
* Avoid combining multiple unrelated purposes into a single layout.

Examples:

* Home: "What is happening in the club right now?"
* Book Detail: "This book as a cultural artifact."
* Vote: "Rank these books quickly."
* Results: "See what is happening live."

Purpose:

* Reduce cognitive load.
* Maintain editorial clarity.
* Prevent feature creep from degrading UX quality.

---

# 23. Canonical Components (MVP)

To prevent UI drift and ensure Codex produces a consistent, modern interface, the app should use a small set of canonical components. Engineers and AI tools should reuse these components across pages rather than inventing new variations.

Principles:

* Prefer composition over one-off layouts.
* Each component has a single responsibility.
* Variants should be explicit (e.g., size="sm|md|lg", tone="primary|secondary|quiet").
* Default styles should follow the Design Tokens, Mobile Grid System, and Interaction Hierarchy Ladder.

### App-Level Shell

1. **AppShell**

* Purpose: Wraps public pages with consistent header/footer spacing.
* Contains: GlobalNav (static), page container with max-width.

2. **GlobalNav**

* Purpose: Static navigation (Level 3 gravity) for: Home, History, My Reviews.
* Rules: Visually quiet, consistent placement, does not change by meeting state.

3. **AdminShell**

* Purpose: Separate admin layout under /admin/* with its own nav and visual treatment.
* Rules: Not accessible from main nav; admins can bookmark.

---

### Layout & Content Blocks

4. **Section**

* Purpose: Standard vertical spacing wrapper for content blocks.
* Props: title?, subtitle?, actionsSlot?, density="sparse|normal".

5. **HeroBlock**

* Purpose: Level A visual anchor for a page (book cover + title).
* Variants: "book", "results".

6. **Card**

* Purpose: Base surface used for content groupings.
* Variants: tone="default|quiet", padding="md|lg".

7. **Banner**

* Purpose: Meeting-state callout / primary CTA container.
* Variants: tone="primary|info|quiet".

8. **MetadataList**

* Purpose: Compact key/value or link list (book metadata, meeting details).
* Rules: Micro-dense; secondary text styling.

---

### Book Components

9. **BookCover**

* Purpose: Displays book cover with consistent 2:3 aspect ratio.
* Props: src, alt, size="xs|sm|md|lg".
* Fallback: Placeholder cover with title/author initials.

10. **BookCard**

* Purpose: Reusable card for History grid and gallery strips.
* Contains: BookCover, title, author, month/year, avg grade (optional).
* Variants: layout="grid|strip".

11. **BookHero**

* Purpose: Detailed hero for Home and Book Detail pages.
* Contains: large BookCover, title/author, meeting month/year, primary links.

---

### Actions & Controls

12. **Button**

* Purpose: Primary and secondary CTAs.
* Variants: tone="primary|secondary|quiet", size="md|lg".

13. **Link**

* Purpose: Consistent link styling for internal/external.
* Variants: external indicator optional.

14. **StatusPill**

* Purpose: Meeting state indicator (Reading/Nominations/Voting/Results).
* Variants: state-driven, visually quiet.

15. **Toast / InlineAlert**

* Purpose: Success/failure feedback for submissions, duplicates, offline retries.
* Variants: tone="success|warning|error|info".

16. **EmptyState**

* Purpose: Friendly empty screens (no nominations, no reviews, no history).
* Contains: title, description, optional action.

---

### Forms

17. **TextField**

* Purpose: Standard single-line input.
* Features: label, hint, error, autoFocus support.

18. **TextAreaMarkdown**

* Purpose: Review body input.
* Features: basic markdown hint + preview toggle (optional).

19. **GradeSlider**

* Purpose: Grade selection for reviews.
* Grades: S, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F (14 grades).
* UI: Range slider (0–13) with dynamic color-coded grade badge above. Each tier has a distinct gradient color scheme: S=gold (premium 3-stop gradient with glow), A=emerald, B=blue, C=warm stone, D=orange, F=red. Tier labels (F, D, C, B, A, S) displayed below the track. Mobile-friendly with 32px thumb and 10px track. Dark mode overrides use translucent tier-colored gradients.

---

### Voting & Results

20. **RankedBallotList**

* Purpose: Displays nominees with drag-to-reorder.
* Behavior: drag on mobile; tap-to-rank fallback.

21. **NomineeRow**

* Purpose: Reusable row inside RankedBallotList.
* Contains: medium BookCover, title/author, pub year/page count (optional), external link.

22. **ResultsChart**

* Purpose: Vertical bar chart for live results.
* Rules: Uses fixed accessible palette; cycles colors deterministically.

23. **ResultsList**

* Purpose: Ranked textual list with points and vote count.

24. **VoteCounter**

* Purpose: Displays "Votes counted: X" + live status.

---

### Reviews

25. **ReviewCard**

* Purpose: Displays a single review.
* Contains: grade badge, markdown body, timestamp; optional reviewer name when authenticated.

26. **ReviewList**

* Purpose: Displays list of ReviewCards with filtering/sorting (optional future).

---

### Authentication & QR

27. **AuthGate**

* Purpose: Wrapper that shows login prompt when actions require auth (reviews, my reviews).

28. **QRPanel** (Admin)

* Purpose: Displays QR code + short URL for Nominate/Vote/Results for a meeting.

29. **VotesInspector** (Admin)

* Purpose: Hidden per-vote table on the pick detail page, revealed via the `?show-votes=yes` query param (no UI link). Shows voter identity, ranking, submitted time, and a delete control.
* `.vote-network-flag`: amber chip (`var(--amber)`, `--radius-sm`, `--font-ui`, `--t-xs`) rendered in the Network column when 2+ votes share a privacy-preserving IP hash (`⚠ N · <label>`). A soft, review-only signal — never auto-blocks a vote.

---

### Profile & Identity Components

29. **AvatarPartial**

* Purpose: Reusable avatar rendering across all views (nav, profile, reviews, member profiles).
* Props: user (email, display_name, avatar_style), size (sm, md, lg).
* Renders DiceBear API URL for selected style, with initials text fallback.
* Located at `views/partials/avatar.ejs`.

30. **AvatarPicker**

* Purpose: Tabbed grid for selecting avatar style on profile page.
* Structure: 3 tabs (Classic / Illustrated / Fun), each containing a grid of preview cards.
* 24 DiceBear styles total across 3 categories.
* Click-to-select with immediate visual update; persists via API call.
* Tab switching via `.avatar-picker__tabs` with `.is-active` state.

31. **MemberProfile**

* Purpose: Public member profile page at `/members/:slug`.
* Sections: Hero (large avatar + display name + join date), Stats bar (review count + avg grade), Social links (Goodreads, StoryGraph, Instagram, Threads — shown only if populated), Reviews list (grade badge + book link + review text + date).
* Protected with `requireMember` middleware.

32. **GradeBadge**

* Purpose: Color-coded grade display used in reviews, member profiles, and book detail pages.
* Variants by tier: `.grade-badge--s` (gold gradient), `--a` (emerald), `--b` (blue), `--c` (stone), `--d` (orange), `--f` (red).
* Dark mode overrides with translucent gradient backgrounds.
* No borders; uses `linear-gradient(135deg, ...)` backgrounds.
* S tier includes subtle `box-shadow` glow effect.

33. **ThemeToggle**

* Purpose: Dark/light mode toggle button in navigation.
* Shows sun icon (light mode) or moon icon (dark mode).
* Persists to `localStorage('theme')` and sets `data-theme` attribute.
* Respects OS preference when no manual choice has been saved.

---

### Reuse Rules (Codex)

* Home, History, Book Detail should be assembled primarily from: AppShell, GlobalNav, Section, BookHero, BookCard/BookCover, MetadataList, ReviewList.
* Nominate and Vote should use focus-mode layout: minimal GlobalNav (or hidden), Section, form components, primary Button.
* Live Results should use: HeroBlock (results), ResultsChart, ResultsList, VoteCounter, StatusPill.
* Do not introduce new card styles without first extending Card or BookCard variants.

---

# 24. Component Inventory by Page (Codex Implementation Guide)

This section maps canonical components to each page so implementation tools (including Codex) produce consistent layouts without inventing new structural patterns.

Principle:

* Pages are assembled from canonical components only.
* Prefer reuse and composition over new UI structures.

---

### Home Page

Primary Narrative: "What is happening in the club right now?"

Core Components:

* AppShell
* GlobalNav
* Section (Header / Identity)
* BookHero (Current Book)
* Banner (Current Action CTA)
* MetadataList (Meeting details)
* Section (Recent History)
* BookCard (layout="strip")

Optional Future:

* StatusPill (meeting state indicator)

---

### History Page

Primary Narrative: "Browse the club's archive."

Core Components:

* AppShell
* GlobalNav
* Section (Page title)
* BookCard (layout="grid")
* EmptyState (if no history yet)

---

### Book Detail Page

Primary Narrative: "This book as a cultural artifact."

Core Components:

* AppShell
* GlobalNav
* BookHero
* MetadataList
* Section (Review Summary with avg grade + distribution)
* ReviewList (each review shows AvatarPartial + reviewer name linked to `/members/:slug` + GradeBadge + markdown body)

Authenticated Enhancements:

* Button (Write a Review / Edit Review)

---

### Nominate Page (Focus Mode)

Primary Narrative: "Submit a nomination quickly."

Core Components:

* AppShell (minimal header)
* Section (focus layout)
* TextField (title)
* TextField (author)
* Button (primary submit)
* InlineAlert / Toast (confirmation/errors)

Rules:

* Avoid extra navigation or secondary content.

---

### Vote Page (Focus Mode)

Primary Narrative: "Rank these books quickly."

Core Components:

* AppShell (minimal header)
* Section
* RankedBallotList
* NomineeRow
* Button (Submit Vote)
* VoteCounter

---

### Live Results Page

Primary Narrative: "See what is happening live."

Core Components:

* AppShell
* GlobalNav (optional minimal presence)
* HeroBlock (results variant)
* ResultsChart
* ResultsList
* VoteCounter
* StatusPill

---

### Review Page

Primary Narrative: "Reflect and submit your review."

Core Components:

* AppShell (focus-shell layout)
* Section
* GradeSlider (range input with dynamic badge)
* TextAreaMarkdown (with inline formatting hint)
* Button (Submit)

---

### Profile Page

Primary Narrative: "Customize your identity in the club."

Core Components:

* AppShell
* GlobalNav
* Section
* AvatarPicker (tabbed: Classic / Illustrated / Fun)
* TextField (display name)
* TextField (social links: Goodreads, StoryGraph, Instagram, Threads)
* TextField (password management)
* Button (Save / Logout)

---

### Member Profile Page

Primary Narrative: "See a fellow member's reading journey."

Core Components:

* AppShell
* GlobalNav
* AvatarPartial (large)
* Section (Stats: review count, avg grade)
* MetadataList (social links)
* ReviewList (with BookCard links and GradeBadge)

---

### My Reviews Page

Primary Narrative: "Your reading history and voice."

Core Components:

* AppShell
* GlobalNav
* Section
* ReviewList
* EmptyState (if no reviews yet)

---

### Admin Pages (Overview Pattern)

Primary Narrative: "Control meeting state quickly."

Core Components:

* AdminShell
* Section (Current State)
* StatusPill
* Button (State transitions)
* QRPanel
* MetadataList (counts/stats)

---

# 25. Component Anatomy Guidelines (AI Implementation Clarity)

To improve consistency when implemented by AI tools (e.g., Codex), core components must include structural anatomy. This prevents layout drift and spacing inconsistencies.

### BookHero Anatomy

Structure:

* Left: BookCover (size="lg", 2:3 ratio)
* Right:

  * Title (Display typography)
  * Author (metadata style)
  * Meeting date / context
  * Primary action group (optional)

Spacing:

* Horizontal gap: ~24px mobile.
* Vertical alignment: center-aligned content block.

### BookCard Anatomy

Structure:

* BookCover (top or left depending on layout variant)
* Title
* Author
* Month/year metadata
* Optional average grade badge

Rules:

* Maintain consistent aspect ratio.
* Avoid additional nested containers unless extending variant.

### Banner Anatomy

Structure:

* Status context text
* Primary CTA button

Rules:

* Single dominant action only.

Purpose:

* Give AI builders clear internal composition to avoid visual inconsistencies.

---

# 26. Layout Constraints (Editorial Guardrails for AI)

To maintain editorial quality and avoid dashboard-style drift, the following constraints apply:

* Never exceed one Hero-level visual anchor per page.
* No more than one primary CTA above the fold (except focus-mode pages).
* Maintain vertical rhythm using the defined spacing scale.
* Avoid placing navigation or controls before contextual understanding.
* Primary content column remains constrained even on wide screens.

Purpose:

* Ensure predictable visual hierarchy when extending UI.

---

# 27. Interaction State Model (Implementation Guidance)

Each interactive surface must clearly define UI states to prevent inconsistent behavior.

### Button States

* Default
* Hover
* Active
* Loading (replace label with spinner, disable interaction)
* Success (brief confirmation state)
* Disabled

### Nominate Flow States

* Initial (empty form)
* Submitting (loading indicator)
* Success (confirmation message + optional next action)
* Already submitted (edit flow)
* Offline/error (retry with stored draft)

### Vote Flow States

* Initial (randomized order)
* Dragging (elevated item visual)
* Submitting (locked UI)
* Submitted (redirect to results)
* Already voted (view results state)
* Voting closed (read-only results preview)

### Live Results States

* Live updating (SSE active)
* Connection lost (reconnecting indicator)
* Finalized (winner emphasized)

Purpose:

* Prevent AI or contributors from inventing inconsistent interaction patterns.

---

# 28. Canonical Page Blueprints (AI Layout Reference)

Provide structural skeletons so AI-generated layouts remain coherent.

### Home Blueprint

AppShell
Section (Identity/Header)
BookHero (Current Book)
Banner (Primary CTA)
MetadataList (Meeting info)
Section (History strip)

### Book Detail Blueprint

AppShell
BookHero
MetadataList
Section (Review Summary)
ReviewList

### Vote Blueprint (Focus Mode)

AppShell (minimal header)
Section
RankedBallotList
Button (Submit)
VoteCounter

### Live Results Blueprint

AppShell
HeroBlock (results)
ResultsChart
ResultsList
VoteCounter
StatusPill

Purpose:

* Ensure structural consistency across implementations.

---

# 29. Component Style Guidance

* Rounded corners should be subtle and modern.
* Clear hover/focus states for accessibility.
* High contrast for readability.
* Large tap targets (minimum 44px) maintained throughout.

---

# 30. Emotional Tone Mapping (Experiential Guidance)

This section defines the emotional intent of each primary page so that layout, spacing, motion, typography emphasis, and interaction patterns feel cohesive and intentional. Emotional tone should guide design decisions without introducing heavy visual theming.

Design Principle:

"Each page has an emotional posture that supports its narrative purpose."

---

### Home Page — Welcoming + Curious

Intent:

* Feel inviting and culturally alive.
* Encourage exploration without overwhelming users.

Design Implications:

* Strong hero presence with breathing room.
* Clear identity and sense of community.
* Gentle motion and calm pacing.

---

### History Page — Archival + Discoverable

Intent:

* Communicate longevity and cultural continuity.
* Encourage browsing and nostalgia.

Design Implications:

* Consistent grid rhythm.
* Predictable layout patterns.
* Emphasis on visual scanning over interaction density.

---

### Book Detail Page — Reflective + Artifact-Focused

Intent:

* Make each book feel like a meaningful cultural object.
* Encourage slower reading and reflection.

Design Implications:

* Larger visual anchors (book cover).
* Generous whitespace around hero elements.
* Editorial typography hierarchy.

---

### Nominate Page — Fast + Frictionless

Intent:

* Reduce hesitation and cognitive load.
* Encourage quick participation during live meetings.

Design Implications:

* Minimal navigation.
* Tight vertical spacing.
* Immediate feedback after submission.

---

### Vote Page — Energetic + Focused

Intent:

* Capture group energy without chaos.
* Make ranking feel clear and tactile.

Design Implications:

* Clear drag affordances.
* Strong primary CTA.
* Visual clarity over decorative elements.

---

### Live Results Page — Communal Excitement + Clarity

Intent:

* Reinforce shared experience during meetings.
* Maintain excitement without visual noise.

Design Implications:

* Animated updates that feel calm but responsive.
* Clear winner emphasis after close.
* Strong hierarchy between chart and supporting data.

---

### Review Page — Personal + Thoughtful

Intent:

* Encourage reflection and expression.
* Feel private and calm rather than social-media-like.

Design Implications:

* Comfortable reading/writing typography.
* Minimal distractions.
* Gentle feedback states.

---

### My Reviews Page — Ownership + Identity

Intent:

* Reinforce personal history and contribution to the club.
* Create sense of continuity across time.

Design Implications:

* Clear list structure.
* Strong readability.
* Subtle emphasis on personal grading patterns.

---

### Admin Pages — Confident + Efficient

Intent:

* Feel reliable and operational without visual clutter.
* Support quick decision-making during meetings.

Design Implications:

* Clear state indicators.
* Large actionable controls.
* Reduced decorative styling.

---

Purpose:

* Align visual and interaction decisions with emotional intent.
* Help AI-assisted implementation maintain tone consistency.
* Prevent drift toward generic dashboard aesthetics.

---

# 31. Information Horizon Model (Progressive Disclosure Guidance)

The interface should intentionally control how much information is visible within the initial viewport to maintain calmness, clarity, and editorial pacing. Rather than exposing all data immediately, pages should reveal depth progressively as users scroll or interact.

Design Principle:

"Show enough to understand — reveal more to explore."

### Initial Viewport Rules (Above-the-Fold Horizon)

When a page first loads, the visible area should typically include:

* One dominant visual anchor (hero-level content).
* Supporting context sufficient for understanding.
* One clear primary action (if applicable).

Avoid showing large volumes of secondary content immediately.

### Progressive Disclosure Layers

Information should unfold in layers as users move downward:

1. **Recognition Layer**

   * Hero or primary artifact.
   * Immediate understanding of page purpose.

2. **Understanding Layer**

   * Metadata and contextual information.
   * Instructions or summaries.

3. **Action Layer**

   * Primary CTA placed after users understand context.

4. **Exploration Layer**

   * Secondary browsing content such as reviews, history lists, or related items.

### Density Guardrails

* Avoid displaying full review lists above the fold.
* Avoid showing multiple galleries or grids immediately on load.
* Large collections should begin slightly below the initial viewport to encourage natural exploration.

### Emotional Intent

* Reduce overwhelm.
* Reinforce editorial calmness.
* Maintain a sense of depth without visual clutter.

### Implementation Guidance (Codex / AI Builders)

* Structure layouts so initial sections occupy meaningful vertical space.
* Prefer section-based loading rather than dense stacked components.
* Maintain clear separation between hero, context, and exploration areas.

Purpose:

* Preserve premium editorial feel as features grow.
* Prevent gradual UI overcrowding.
* Ensure consistent pacing across pages.

---

# 32. Mood Board & Design References (Recommended Practice)

Maintaining a small mood board or visual reference collection is encouraged to guide consistent implementation.

Recommended contents:

* Screenshot references from record.club and similar editorial apps.
* Typography examples demonstrating desired hierarchy.
* Color palette inspirations (neutral editorial bases with subtle accents).
* Examples of clean mobile-first layouts with generous spacing.

Purpose:

* Provide visual alignment for future contributors or AI-assisted design.
* Reduce subjective interpretation of design goals.

This mood board is a supporting artifact and does not need to live directly in the codebase; a shared design reference document is sufficient.

---
