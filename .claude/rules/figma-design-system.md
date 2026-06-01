# Figma MCP Design System Rules

These rules define how to translate Figma designs into code for the SF Book Club v3 project. Follow them for every Figma-driven change.

---

## Required Flow (do not skip)

1. Run `get_design_context` first to fetch the structured representation for the exact Figma node(s)
2. If the response is too large or truncated, run `get_metadata` to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`
3. Run `get_screenshot` for a visual reference of the node/variant being implemented
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation
5. Translate the Figma MCP output (typically React + Tailwind) into this project's conventions: **EJS templates + vanilla CSS with BEM naming + CSS custom properties**
6. Validate against Figma for 1:1 look and behavior before marking complete

---

## Tech Stack (No Build Step)

- **Server:** Node.js + Express.js (CommonJS)
- **View engine:** EJS (server-side rendering)
- **Styling:** Vanilla CSS with CSS custom properties — no Tailwind, no preprocessor, no CSS-in-JS
- **JavaScript:** Vanilla JS modules loaded via `<script defer>` — no bundler, no ES modules
- **Database:** SQLite via better-sqlite3

IMPORTANT: There is zero build step. No bundler, no transpiler, no framework. All CSS and JS are served as static files from `/public/`.

---

## CSS Architecture

Three files loaded in order — **order matters for the cascade**:

| File | Purpose | Cache version |
|------|---------|---------------|
| `/public/css/tokens.css` | Design tokens (CSS custom properties on `:root`) | `?v=N` |
| `/public/css/base.css` | Typography classes, resets, utilities, layout | `?v=N` |
| `/public/css/components.css` | Component-scoped styles using BEM | `?v=N` |

IMPORTANT: When adding new styles, place them in the correct file:
- New design tokens → `tokens.css`
- New typography/utility classes → `base.css`
- New component styles → `components.css`

IMPORTANT: After modifying CSS, bump the `?v=N` query string in **all 4 shell layouts** (`views/layouts/app-shell.ejs`, `admin-shell.ejs`, `focus-shell.ejs`, `landing-shell.ejs`) for cache busting.

---

## Design Tokens

All tokens are CSS custom properties defined in `tokens.css` on `:root`.

IMPORTANT: Never hardcode colors, spacing, font families, radii, or shadows. Always reference tokens.

### Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg` | #FFFFFF | #1a1a1a | Page background |
| `--surface` | #FAFAFA | #242424 | Card/surface background |
| `--surface2` | #F0F0F0 | #2f2f2f | Secondary surface |
| `--text` | #000000 | #E5E5E5 | Primary text |
| `--text2` | #666666 | #A0A0A0 | Secondary text (metadata) |
| `--text3` | #999999 | #707070 | Tertiary text (disabled, hints) |
| `--border` | #E5E5E5 | #333333 | Default borders |
| `--border2` | #F0F0F0 | #2a2a2a | Subtle borders |
| `--accent` | #b45309 | #d97706 | Amber — links, brand identity |
| `--accent2` | #0f766e | #14b8a6 | Teal — status indicators |
| `--success` | #16a34a | #22c55e | Confirmations |
| `--danger` | #b91c1c | #ef4444 | Errors, destructive |
| `--star` | #F5A623 | #F5A623 | Star ratings (immutable) |
| `--amber` | #f59e0b | #f59e0b | Badges, warnings |
| `--cta-bg` | #000000 | #FFFFFF | CTA button background |
| `--cta-text` | #FFFFFF | #000000 | CTA button text |
| `--shadow` | rgba(0,0,0,0.06) | rgba(0,0,0,0.25) | Elevation |
| `--admin-surface` | #F8F6F2 | #1E1C18 | Admin background |
| `--admin-border` | #E8E4DC | #3a3630 | Admin borders |

### Spacing (8pt grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--s-1` | 4px | Fine-tuning, half-grid |
| `--s-2` | 8px | Tight spacing |
| `--s-3` | 16px | Standard gap |
| `--s-4` | 24px | Section internal padding |
| `--s-5` | 32px | Section padding |
| `--s-6` | 48px | Major section gaps |
| `--s-7` | 64px | Page vertical rhythm |
| `--s-8` | 80px | Hero/feature sections |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-brand` | 'DM Serif Display', Georgia | Brand logotype |
| `--font-display` | 'Fraunces', Georgia | Hero book titles only |
| `--font-reading` | 'Source Serif 4', Georgia | Author names |
| `--font-body` | 'Inter', system-ui | Body text, forms |
| `--font-ui` | 'IBM Plex Sans', system-ui | Badges, labels |
| `--font-secondary` | 'Source Sans 3', system-ui | Secondary body |
| `--t-xs` | 0.85rem | Captions, labels |
| `--t-sm` | 0.95rem | Nav, secondary, buttons |
| `--t-base` | 1.1rem | Body text |
| `--t-lg` | 1.25rem | Section emphasis |
| `--t-xl` | 1.65rem | Section headings |

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Inputs, small corners |
| `--radius-md` | 8px | Cards, standard corners |
| `--radius-lg` | 100px | Pill-shaped buttons |

### Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--maxw` | 860px | Main content width |
| `--content-width` | 960px | Wide sections (home hero) |
| `--gutter` | 24px | Horizontal page padding |

---

## Typography Classes

Use these predefined classes from `base.css` instead of writing custom font rules:

| Class | Font | Size | Weight | Use |
|-------|------|------|--------|-----|
| `.t-brand` | DM Serif Display | 16px | 400 | Brand logotype |
| `.t-section` | DM Serif Display | 24px | 400 | Section headings |
| `.t-display` | Fraunces | 40-48px (clamp) | 700 | Hero book titles |
| `.t-author` | Source Serif 4 italic | 17px | 400 | Author names |
| `.t-body` | Inter | 16px | 400 | Body text |
| `.t-body-bold` | Inter | 16px | 600 | Emphasized body |
| `.t-label` | IBM Plex Sans | 13px | 500 | Uppercase labels |
| `.t-button` | Inter | 14px | 600 | Button text |
| `.t-stat` | Inter | 28px | 700 | Large stat numbers |
| `.t-nav` | Inter | 14px | 400-500 | Navigation links |
| `.t-secondary` | Source Sans 3 | 14px | 400-500 | Secondary text |
| `.t-caption` | Inter | 13px | 400 | Captions |
| `.t-caption-bold` | IBM Plex Sans | 13px | 600 | Bold captions |

---

## CSS Naming Conventions (BEM-Inspired)

- **Block:** Lowercase with hyphens, semantic → `.book-hero`, `.admin-form`, `.review-card`
- **Element:** Double underscore → `.book-hero__title`, `.nav-links__avatar`
- **Modifier:** Double hyphen → `.book-cover--lg`, `.btn--primary`
- **State:** `.is-active`, `.is-open` (toggled by JS)
- **Semantic prefixes by domain:**
  - `book-*` — Book/editorial components
  - `admin-*` — Admin UI
  - `ballot-*` — Voting
  - `review-*` — Reviews
  - `home-*` — Homepage-specific
  - `btn` / `btn--*` — Buttons
  - `t-*` — Typography utility classes

---

## Translating Figma MCP Output

The Figma MCP server returns React + Tailwind code. You MUST translate it to this project's conventions:

### Mapping Figma → Project

| Figma / Tailwind | Project Equivalent |
|------------------|--------------------|
| `<div className="flex flex-col gap-4">` | `<div class="stack" style="gap: var(--s-3)">` or a BEM block |
| `text-gray-500` | `color: var(--text2)` |
| `bg-white` | `background: var(--bg)` |
| `rounded-lg` | `border-radius: var(--radius-md)` |
| `p-4` | `padding: var(--s-3)` |
| `text-sm font-medium` | Class `.t-secondary` or `.t-label` |
| `text-2xl font-bold` | Class `.t-section` or `.t-display` |
| React `<Component />` | EJS `<%- include('partials/component') %>` |
| React `useState` / events | Vanilla JS in `/public/js/feature-name.js` |
| `className` | `class` |

### Key Patterns

- **Flexbox layouts:** Use standard CSS `display: flex` with token-based gaps
- **Grid layouts:** Use CSS Grid with token-based gaps
- **Responsive:** Mobile-first with breakpoints at `640px` and `480px`
- **Dark mode:** Already handled by token system — tokens swap values automatically via `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`

---

## File Organization

### Where to place new code

| Type | Location |
|------|----------|
| New page template | `/views/page-name.ejs` |
| New partial/component | `/views/partials/component-name.ejs` |
| Page layout | `/views/layouts/shell-name.ejs` |
| Admin template | `/views/admin/feature-name.ejs` |
| Component styles | `/public/css/components.css` (append) |
| New tokens | `/public/css/tokens.css` |
| Page-specific JS | `/public/js/feature-name.js` |
| Route handler | `/routes/feature-name.js` |
| Business logic | `/services/feature-name.js` |

### JavaScript Patterns

- Each JS file wraps code in an IIFE: `(function(){ ... })()`
- DOM elements found by ID (camelCase): `document.getElementById('searchInput')`
- Data passed from server via `data-*` attributes on HTML elements
- JS reads config via `element.dataset.*`

---

## Asset Handling

- IMPORTANT: If the Figma MCP server returns a localhost source for an image or SVG, use that source directly
- IMPORTANT: DO NOT import/add new icon packages — all assets should come from the Figma payload
- IMPORTANT: DO NOT use or create placeholder images if a localhost source is provided
- Store downloaded images in `/public/img/` (book covers are stored on the persistent data volume at `<dataDir>/covers/`, served at `/img/covers/` — NOT in `public/`)
- Inline SVGs are preferred for icons (not icon fonts, not external SVG files)
- Book covers are lazy-loaded from Google Books API, OpenLibrary, or uploaded
- Avatars use DiceBear API with initials fallback

---

## Existing Components to Reuse

Before creating new components, check if these existing ones serve the need:

- **`.book-card`** — Grid (`.book-card--grid`) and strip (`.book-card--strip`) layouts for book items
- **`.book-cover`** — Image container with size variants (`--sm`, `--md`, `--lg`)
- **`.book-hero`** — Primary editorial layout for book detail pages
- **`.btn`** — Button with variants (`--primary`, `--secondary`, `--ghost`, `--danger`)
- **`.status-pill`** — Status badges (reading, completed, upcoming)
- **`.grade-badge`** — Letter grade display (A+, B-, etc.)
- **`.announcement`** — Alert/banner system
- **`.admin-meeting-card`** — Admin meeting display card
- **`.admin-form`** — Admin form layouts
- **`.ballot-card`** — Voting interface card
- **`.review-card`** — Review display
- **`partials/avatar.ejs`** — User avatar (DiceBear + initials fallback)
- **`partials/global-nav.ejs`** — Site navigation
- **`partials/pagination.ejs`** — Pagination controls
- **`partials/placeholder-cover.ejs`** — Fallback book cover

---

## Design Principles

When translating Figma designs, respect these principles:

1. **Artifact Over Interface** — Content dominates, UI recedes. Minimal chrome.
2. **Quiet Confidence** — Generous whitespace, no gratuitous decoration.
3. **Editorial, Not Dashboard** — Information is narrated, not tabulated.
4. **Near-Zero UI Color** — White surfaces, black text, amber/teal accents used sparingly. Book covers provide all visual richness.

---

## Accessibility

- WCAG AA compliance (contrast, keyboard nav, screen reader support)
- Semantic HTML with appropriate ARIA attributes
- Focus-visible indicators: `outline: 2px solid var(--accent)` with `2px` offset
- All interactive elements must be keyboard-accessible
- Reduced motion: respect `prefers-reduced-motion: reduce`

---

## Dark Mode

Dark mode is already handled by the token system. Do NOT create separate dark-mode styles. The dual-selector pattern in `tokens.css` swaps all `--*` values automatically:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark token overrides */ }
}
[data-theme="dark"] { /* dark token overrides */ }
```

If you need a new color, add it to BOTH the `:root` block and the dark-mode selectors in `tokens.css`.
