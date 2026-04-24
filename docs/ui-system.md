# UI / UX Design System — Knowledge Base

> A premium, Linear-grade interface system. Opinionated, restrained, engineered.
> Built on **Tailwind v4 + shadcn/ui + Framer Motion + Inter / JetBrains Mono**.

---

## 1. Design Principles

1. **Content is the product.** Chrome recedes; typography and whitespace do the work.
2. **Density with breathing room.** High information density per screen, but never cramped — spacing is the grid, not an afterthought.
3. **One accent, many neutrals.** A single saturated accent used sparingly. Everything else is a precisely calibrated gray scale.
4. **Every surface is flat.** No drop shadows on cards. Elevation is conveyed by **hairline borders** and **tonal shifts**, not shadow blur.
5. **Motion clarifies, never decorates.** Micro-interactions ≤200ms, eased, purposeful. Animation *explains* state changes — it does not announce them.
6. **Keyboard first.** Every action reachable via `⌘K` or a dedicated shortcut. Focus rings are a feature, not a fallback.
7. **Latency is a design material.** Skeletons match final geometry; optimistic mutations land instantly; slow data streams in.
8. **Instrumented elegance.** Beautiful ≠ ornate. If a pixel doesn't serve clarity, hierarchy, or rhythm — cut it.
9. **Dark mode is first-class.** Designed in parallel, not inverted.
10. **Boring is a feature.** Predictable layouts, stable affordances, no novelty for its own sake.

---

## 2. Typography

### 2.1 Families
- **Sans (UI + prose):** `Inter Variable` — `font-feature-settings: "cv11","ss01","ss03"` for open digits, single-story `a`, humanist `l`. `text-rendering: optimizeLegibility`.
- **Mono (code, IDs, shortcuts):** `JetBrains Mono Variable`.
- **Serif (optional, long-form reading):** `Source Serif 4` — used only in the article viewer at user opt-in.

### 2.2 Scale (modular, 1.125 minor third)

| Token | Size / LH | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-display` | 40 / 48 | 600 | −0.02em | Marketing hero only |
| `text-h1` | 30 / 38 | 600 | −0.015em | Page title |
| `text-h2` | 24 / 32 | 600 | −0.01em | Section header |
| `text-h3` | 19 / 28 | 600 | −0.005em | Card title, article H2 |
| `text-h4` | 16 / 24 | 600 | 0 | Subsection |
| `text-body` | 14 / 22 | 400 | 0 | Default body |
| `text-body-lg` | 16 / 26 | 400 | −0.003em | Article body |
| `text-small` | 13 / 20 | 400 | 0.003em | Meta |
| `text-xs` | 12 / 16 | 500 | 0.02em | Badges, captions |
| `text-mono` | 13 / 20 | 450 | 0 | Code, IDs |
| `text-kbd` | 11 / 14 | 500 | 0.04em | Keyboard keys |

### 2.3 Rules
- **Never go above weight 600** in the UI. Use 400/450/500/600. Bold-7/800 is reserved for marketing.
- **Negative tracking scales with size.** Large type tightens; small type loosens.
- **Line length capped at 72ch** for article body; 52ch for summaries.
- **Headings are near-black (`fg`), not pure black.** Body is `fg-muted`. Meta is `fg-subtle`. Four tiers, never more.
- **Numerals use `font-feature-settings: "tnum"`** inside tables and any aligned list.

---

## 3. Spacing

### 3.1 4px base grid
All spacing is a multiple of 4. Core scale: `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24` (rem: `0.25` to `6`).

### 3.2 Semantic spacing tokens

| Token | px | Role |
|---|---|---|
| `space-hairline` | 1 | borders, dividers |
| `space-tight` | 4 | inline gaps (icon ↔ label) |
| `space-snug` | 8 | compact clusters |
| `space-base` | 12 | default stack gap |
| `space-comfy` | 16 | card interior padding |
| `space-loose` | 24 | section gap inside a page |
| `space-section` | 40 | between major sections |
| `space-gutter` | 64 | page outer gutter on `xl` |

### 3.3 Grid & containers
- Page container: `max-w-[1200px] mx-auto px-6 md:px-10`.
- Article reading container: `max-w-[720px]`.
- Sidebar: fixed `260px` expanded, `64px` collapsed.
- 8-column grid for dashboard widgets on `lg+`, 4-column on `md`.

### 3.4 Radius
Single scale, intentionally restrained:
- `rounded-sm` `4px` — inputs, small buttons, kbd.
- `rounded-md` `6px` — default (cards, menus, badges).
- `rounded-lg` `10px` — dialogs, popovers.
- `rounded-full` — avatars, pills only.
No `rounded-2xl`+ anywhere. Overly round corners read as consumer, not tool.

### 3.5 Borders
- **Hairline = 1px**, color `border` (near-transparent neutral).
- Focused elements gain a 1px ring at `ring`, not a thicker border (prevents layout shift).
- Dividers are `border-t` with `border-subtle`, never `bg-gray-200` bars.

---

## 4. Color System

Designed in **OKLCH** for perceptual uniformity, exposed as CSS variables. Both themes are *crafted*, not algorithmically inverted.

### 4.1 Neutral ramps (12 steps, Radix-style semantic numbering)

Scale meaning: `1` background · `2` subtle bg · `3` hovered bg · `4` active bg · `5` subtle border · `6` border · `7` hovered border · `8` solid border · `9` solid bg · `10` hover solid · `11` low-contrast text · `12` high-contrast text.

**Light (`gray`)**
```
--gray-1:  oklch(99% 0.002 264);   /* app background */
--gray-2:  oklch(98% 0.003 264);   /* subtle surface */
--gray-3:  oklch(96% 0.004 264);
--gray-4:  oklch(94% 0.005 264);
--gray-5:  oklch(92% 0.006 264);
--gray-6:  oklch(89% 0.007 264);   /* default border */
--gray-7:  oklch(85% 0.008 264);
--gray-8:  oklch(78% 0.009 264);
--gray-9:  oklch(55% 0.010 264);
--gray-10: oklch(50% 0.010 264);
--gray-11: oklch(42% 0.012 264);   /* muted text */
--gray-12: oklch(14% 0.014 264);   /* primary text */
```

**Dark (`grayDark`)** — not an inversion; lifted blacks and desaturated highlights.
```
--gray-1:  oklch(14% 0.010 264);   /* app background */
--gray-2:  oklch(17% 0.011 264);
--gray-3:  oklch(20% 0.012 264);
--gray-4:  oklch(23% 0.013 264);
--gray-5:  oklch(26% 0.014 264);
--gray-6:  oklch(30% 0.015 264);
--gray-7:  oklch(35% 0.016 264);
--gray-8:  oklch(42% 0.017 264);
--gray-9:  oklch(55% 0.018 264);
--gray-10: oklch(62% 0.018 264);
--gray-11: oklch(72% 0.015 264);
--gray-12: oklch(96% 0.008 264);
```

### 4.2 Accent — "Iris" (single, restrained)
```
light:  --accent-9:  oklch(58% 0.19 275);   /* primary action */
        --accent-10: oklch(54% 0.20 275);
        --accent-11: oklch(48% 0.19 275);   /* accent text */
        --accent-3:  oklch(96% 0.02 275);   /* subtle tint */

dark:   --accent-9:  oklch(66% 0.19 275);
        --accent-10: oklch(72% 0.19 275);
        --accent-11: oklch(78% 0.17 275);
        --accent-3:  oklch(24% 0.04 275);
```
**Used for:** primary button, focus ring, active nav item indicator, link, selection highlight. Nothing else.

### 4.3 Status
Desaturated; never primary red/green/yellow.
```
success: oklch(62% 0.14 155)    / dark: oklch(70% 0.14 155)
warning: oklch(72% 0.14 75)     / dark: oklch(78% 0.15 75)
danger:  oklch(58% 0.20 25)     / dark: oklch(66% 0.20 25)
info:    oklch(62% 0.14 230)    / dark: oklch(70% 0.14 230)
```

### 4.4 Semantic tokens (the only names used in components)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `bg` | `--gray-1` | `--gray-1` | app background |
| `bg-subtle` | `--gray-2` | `--gray-2` | cards, sidebar |
| `bg-hover` | `--gray-3` | `--gray-3` | hover surface |
| `bg-active` | `--gray-4` | `--gray-4` | pressed / selected |
| `bg-inset` | `--gray-2` | `--gray-2` | code blocks, insets |
| `border` | `--gray-6` | `--gray-6` | default hairline |
| `border-subtle` | `--gray-5` | `--gray-5` | dividers |
| `border-strong` | `--gray-8` | `--gray-8` | emphasized |
| `ring` | `--accent-9` at 35% | `--accent-9` at 40% | focus |
| `fg` | `--gray-12` | `--gray-12` | primary text |
| `fg-muted` | `--gray-11` | `--gray-11` | body / secondary |
| `fg-subtle` | `--gray-9` | `--gray-10` | meta / captions |
| `fg-on-accent` | `white` | `white` | text over accent |
| `accent` | `--accent-9` | `--accent-9` | brand action |
| `accent-hover` | `--accent-10` | `--accent-10` | action hover |

### 4.5 Rules
- **Never `bg-white` or `bg-black`.** Always a token.
- **Backgrounds differ by at most 2 neutral steps per viewport**; more than that looks banded.
- **Text on accent is always pure white**, never a neutral.
- **Selection highlight:** `accent-3` with `fg` text.
- **Charts** use a fixed 6-swatch palette derived from the accent + 5 analogous hues at matched lightness — never rainbow.

---

## 5. Component Philosophy

- **Composition over configuration.** Built on shadcn primitives; extended via variants, not props explosions.
- **Three variant axes max** per component: `variant` (semantic style) · `size` · `intent` (status).
- **Every interactive element has six states**: default, hover, focus-visible, active, disabled, loading. No state is skipped.
- **Icon set:** Lucide exclusively. 1.5px strokes. 16px or 14px in dense UI; 20px in primary actions. Never mix with other icon sets.
- **Empty, loading, error, and success states are designed at the same time as default.** PRs that ship only the happy path are rejected.
- **Skeletons are geometry-accurate.** They match the final layout so there's no content shift on load.
- **Tactile feedback via pressed state**, not shadow pulses: 1% darkening, 1px inward shift on `:active`.
- **Hit targets ≥ 32px.** Dense rows use a 32px row height; touch targets 40px.
- **Tone is quiet.** Copy is declarative, not cheerful. "No articles yet." beats "Oops, nothing here! 🎉".

### 5.1 Buttons (taxonomy)
- `primary` — accent fill, white text. One per view.
- `secondary` — `bg-subtle`, `border`, `fg`. Default action.
- `ghost` — transparent, hover `bg-hover`. Toolbar use.
- `outline` — transparent with `border`. Paired with secondary in dialogs.
- `danger` — danger-9 fill, used only for destructive confirms.
- Sizes: `sm 28px` · `md 32px` · `lg 36px`. No XL buttons.

### 5.2 Inputs
- Height matches button sizes.
- 1px `border`, 8px horizontal padding, no inner shadow.
- On focus: border becomes `accent` + 1px `ring` inset — not a 3px halo.
- Errors shown below the field as a single line of `danger-11` text; border turns `danger-8`.
- Labels are 13px `fg-muted` above the field, not floating.

### 5.3 Badges
- 20px height, 8px horizontal padding, 11px `tnum` text.
- Variants tint the background at step 3 and text at step 11 — never solid fills except `status=success/danger`.

---

## 6. Motion Guidelines

### 6.1 Tokens
```ts
export const motion = {
  duration: {
    instant: 80,     // toggle feedback
    fast: 140,       // hover → pressed transitions
    base: 200,       // menus, dialogs open
    slow: 320,       // panel slide-in, page transitions
  },
  ease: {
    out:    [0.16, 1, 0.3, 1],     // Vercel-style easeOut — crisp entry
    inOut:  [0.4, 0, 0.2, 1],      // standard material
    spring: { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 },
  },
};
```

### 6.2 Rules
- **200ms ceiling for UI affordances.** Anything longer reads as latency.
- **No animation on color changes** to text or text backgrounds in dense UI — causes shimmering on scroll.
- **Shared-element transitions** (Framer Motion `layoutId`) for nav item active-indicator, tab underline, sidebar collapse arrow.
- **Entry: fade + 4px translate from origin.** Exit: fade only, 120ms.
- **Stagger at most 3 items** (rows, cards). Beyond that, stagger looks busy.
- **Respect `prefers-reduced-motion`:** swap spring/slide for fade-only at 100ms; disable layout animations.
- **Never bounce** default UI (only playful confirmations, e.g. helpful-vote check).

### 6.3 Framer Motion patterns
```tsx
<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2, ease: motion.ease.out }}
/>
```
Page-level transitions wrap `<AnimatePresence mode="popLayout">` only around the routed content, never the shell.

---

## 7. Core Components

### 7.1 Sidebar

**Geometry**
- `260px` expanded · `64px` collapsed (icon rail). Smooth spring collapse (`layout` animation).
- Full height, `bg-subtle`, `border-r border`.
- `12px` top padding, `8px` horizontal padding, `4px` gap between items.

**Structure**
```
┌──────────────────────────┐
│ Workspace switcher       │  ← 40px row with avatar + name + ⌄
├──────────────────────────┤
│ ⌘K Search…               │  ← command palette trigger, 32px
├──────────────────────────┤
│  NAVIGATION              │  ← 11px uppercase caption, fg-subtle
│  ◉ Dashboard             │
│  ◉ Articles       128   │  ← count pill, tnum, fg-subtle
│  ◉ Categories           │
│  ◉ Search               │
├──────────────────────────┤
│  LIBRARY                 │
│  ▸ Networking            │  ← collapsible tree, 1-level indent
│  ▾ Hardware              │
│     ▸ Laptops            │
│  ▸ Access                │
├──────────────────────────┤
│ ─ divider ─              │
│ ◉ Admin                  │  ← role-gated
├──────────────────────────┤
│ ⌂ User · Settings        │  ← sticky bottom, avatar + menu
└──────────────────────────┘
```

**Interaction**
- Active item: `bg-active` + `fg` text + a **2px tall, 16px wide accent bar** on the left edge via `layoutId="sidebar-indicator"` so it *slides* between items.
- Hover: `bg-hover` only. No scale, no shadow.
- Icon 16px, 12px gap to label. Ellipsis truncation with tooltip on hover after 300ms delay.
- Collapsed: labels and counts hide, left-edge indicator remains, tooltips become primary affordance.
- Scrollbar: hidden until hover (`scrollbar-thin`, `scrollbar-color: transparent`).
- Keyboard: `[` / `]` to collapse/expand, `j` / `k` to move focus.

### 7.2 Topbar

**Geometry**
- `52px` tall, sticky, `backdrop-blur-[8px]`, `bg/80`, `border-b border-subtle`.

**Layout (three-zone)**
```
[breadcrumbs ] ········ [ global search (⌘K) ] ········ [ theme · bell · user ]
```

- **Breadcrumbs:** `text-small fg-muted`, `/` divider at 30% opacity. Last crumb `fg`. Long crumbs truncate with middle-ellipsis.
- **Global search:** 380px pill input, always visible on `lg+`; reduces to an icon on `md`. Opens command palette on focus/`⌘K`. Shows `⌘K` kbd badge on the right.
- **Right cluster:**
  - Theme toggle — icon-only ghost button, rotates 180° on change.
  - Notifications — bell with a 6px unread dot (`accent`); opens a 380px popover with grouped notifications.
  - User menu — avatar button (28px), popover with name, email, org, shortcuts, sign out.

**Scroll behavior**
- Solid `bg` when page scrolls > 4px (triggered via IntersectionObserver on a sentinel). Transition 140ms.

### 7.3 Article Editor

Built on **Tiptap** with a custom toolbar. Notion-style drag-handle + slash menu.

**Layout**
```
┌────────────────────────────────────────────┐
│  Title (contenteditable, 30/38 600)        │
│  Add summary… (muted placeholder)          │
├────────────────────────────────────────────┤
│  ⋮⋮  [+]   Body…                            │  ← hover row reveals handle + "+"
│                                             │
│      /      ← slash menu on new line        │
└────────────────────────────────────────────┘
```

**Toolbar**
- **Floating** on selection (appears above selected text, 28px tall, `bg` with `border`, `rounded-md`, 4px padding).
- Buttons: B, I, U, S, code, link, H2, H3, quote, list, check, divider.
- Never a top-docked ribbon — breaks the writing surface.

**Slash menu (`/`)**
- Opens a 280px popover at caret; filters as you type.
- Groups: Basic (text, h2, h3, quote, divider), Lists, Media (image, file, code block), Advanced (callout, toggle, table, embed).
- Each item: 16px icon · title · `fg-subtle` description · kbd hint.
- Arrow keys, enter, escape. Fuzzy match.

**Drag handle**
- Appears 12px left of each block on hover. `grip-vertical` icon, `fg-subtle`.
- Click opens a block menu (duplicate, turn into, color, delete). Drag reorders with `layout` animation.

**Inline polish**
- Link editing inline: select → floating link input with favicon preview, unfurled on paste.
- Code blocks: Shiki-rendered, 13/20 mono, `bg-inset`, 1px border, copy button appears on hover.
- Image: drag-to-upload or paste; shows a skeleton the exact size of the image while uploading (direct-to-S3 via presigned URL); alt-text prompt after upload.
- Callouts: left accent bar, tinted `bg-subtle`, icon, no border.
- `@mention` users and `#` link articles, resolved via the command palette engine.

**Autosave**
- Debounced 600ms; status in the topbar: "Saved · 2s ago" / "Saving…" / "Offline — will retry".
- Version created on focus loss + meaningful change (diff > 20 chars).

**Keyboard**
- Full Markdown shortcuts (`# `, `## `, `- `, `1. `, `> `, ``` ` ```).
- `⌘↵` to save & close. `⌘⇧P` to publish (triggers confirmation dialog).

### 7.4 Article Viewer

**Reading-first canvas.**
- Container `max-w-[720px] mx-auto px-6 py-10`.
- Title 30/38 600, `-0.015em`, `fg`. Published metadata line below: avatar + name · relative date · reading time · category · tags. `text-small fg-subtle`.
- Body uses `text-body-lg` (16/26) `fg-muted`. Headings re-engage `fg`.
- **Prose rules:** 72ch max width (redundantly enforced on the prose element), 24px between paragraphs, 40px above H2, 28px above H3. Lists use 8px tight spacing with 16px left indent.
- **Inline code:** `bg-inset` · 1px border · 2px/4px padding · 12px mono.
- **Code blocks:** Shiki, both-theme aware. Filename tab on top when provided. Copy button top-right (appears on hover). Line numbers toggled per block.
- **Callouts:** `info`, `warning`, `danger`, `tip` — left 2px accent bar, icon, `bg-subtle`.
- **Images:** full-width within container, rounded `md`, caption below in `text-small fg-subtle`. Click opens lightbox with zoom.
- **Tables:** compact, zebra via `bg-subtle` on even rows, sticky header.
- **Table of contents:** right rail on `xl+` (240px), sticky, current-section highlighted via IntersectionObserver with `layoutId` indicator (same technique as sidebar).

**Engagement rail (bottom)**
```
Was this helpful?   [👍 Yes · 42]   [👎 No · 3]     Last updated 2d ago by Jane
```
- Helpful: thumbs pressed animate with a subtle scale spring (the only bounce in the app).
- After vote: replaced with "Thanks for the feedback." and an optional single-line comment input.
- Below: "Related articles" — 3-card grid from search-engine "more like this".

**Annotations**
- Selection triggers a tiny floating "Copy link to selection" and "Leave feedback on this passage" — feedback attaches a comment anchored to the text range.

### 7.5 Cards

One card family, three variants:

- **List card** — full-width row in a stacked list; hover raises border from `border-subtle` to `border`; title link, meta row below, status badge right-aligned. No shadow.
- **Tile card** — square-ish grid cell; 16px padding; header with icon + title; single line of body; footer with meta. Used on dashboards.
- **Feature card** — larger, used on empty states or promos; optional illustration on the right; primary button anchored bottom-left.

**Anatomy (shared)**
```
┌────────────────────────────────────────┐
│  Header       (title + trailing badge) │
│  ─────────── (optional hairline)       │
│  Body (1–3 lines, line-clamp)          │
│  Footer (meta: author · date · counts) │
└────────────────────────────────────────┘
```

**Spec**
- `bg-subtle`, `border border`, `rounded-md`, `p-4` default (`p-5` for Feature).
- Hover: `border-strong` + `bg-hover` tint (1% delta). No translate, no shadow.
- Keyboard: whole card focusable when clickable; focus-ring on the card edge, not the title.
- Selected state (e.g. multi-select lists): left 2px `accent` bar + `bg-active`.

### 7.6 Tables

Dense, calm, legible.

**Geometry**
- Row height: `40px` default, `32px` compact mode.
- Horizontal padding: 12px per cell; first/last cell 16px.
- Hairline `border-b border-subtle` between rows; **no vertical grid lines**.
- Header: `bg-subtle`, `text-xs fg-subtle` uppercase caption, sticky on scroll.

**Behavior**
- Hover row: `bg-hover`. Row click is the primary action; icon actions align right and appear on hover (`opacity-0 → 100 fast`).
- Sort: click header; icon is `chevron-up/down` at 12px `fg-subtle`. Only one sorted column at a time.
- Resize: 4px grab handle on header right edge; drag updates a CSS variable (column widths stored in `useUIStore`).
- Selection: left checkbox column (40px). Selected row: 2px `accent` bar left + `bg-active`.
- Pagination: cursor-based; footer `"1–20 of 1,248"` in `text-small fg-subtle` + `Prev` / `Next` ghost buttons. `⌘[` / `⌘]` shortcuts.
- Empty state replaces the tbody with a centered `EmptyState` at `min-h-[240px]`.
- Loading: 6–10 skeleton rows with cell-shaped rectangles.

**Typography**
- Default cells `text-body`. Numeric cells right-aligned with `tnum`.
- Primary column (e.g. article title) weighted 500, `fg`. Secondary columns `fg-muted`.
- Timestamps always relative with an absolute tooltip on hover.

**Bulk bar**
- When ≥1 row selected, a floating action bar slides up from the bottom (`y: 8 → 0`, 200ms, `ease.out`), pinned to the table container: shows `"3 selected"`, bulk actions (`Archive`, `Move to…`, `Delete`), and a close button. Dismissed with `Esc`.

---

## 8. Tailwind v4 Token Wiring (for reference)

In `globals.css` (Tailwind v4 uses `@theme` directive):

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --font-serif: "Source Serif 4", ui-serif, serif;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  --color-bg: var(--gray-1);
  --color-bg-subtle: var(--gray-2);
  --color-bg-hover: var(--gray-3);
  --color-bg-active: var(--gray-4);
  --color-bg-inset: var(--gray-2);
  --color-border: var(--gray-6);
  --color-border-subtle: var(--gray-5);
  --color-border-strong: var(--gray-8);
  --color-ring: var(--accent-9);
  --color-fg: var(--gray-12);
  --color-fg-muted: var(--gray-11);
  --color-fg-subtle: var(--gray-9);
  --color-accent: var(--accent-9);
  --color-accent-hover: var(--accent-10);
}

:root { /* light ramps */ }
[data-theme="dark"] { /* dark ramps */ }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Components consume semantic tokens only: `bg-bg`, `text-fg`, `border-border`, `ring-ring`. No raw gray-500 anywhere in the codebase.

---

## 9. Accessibility (non-negotiable)

- WCAG 2.2 AA contrast for all text/background pairings (checked in Storybook + CI via `axe`).
- Focus-visible ring on every interactive element. Never `outline: none` without a replacement.
- Hit targets ≥ 32px (dense) / 40px (touch).
- Motion respects `prefers-reduced-motion`.
- Color is never the only signal — status badges pair color with an icon and label.
- All dialogs/menus use Radix primitives: proper roles, focus trap, `Esc` to close, scroll locking.

---

## 10. Tone & Microcopy

- **Declarative, specific, lowercase button labels with one capital:** `New article`, not `CREATE NEW ARTICLE+`.
- **Never exclamation marks** outside toasts for destructive undo.
- **Error copy tells you the next action:** "We couldn't save this article. Check your connection, then retry."
- **Time is always relative + absolute on hover.** "Updated 2d ago" → tooltip "April 20, 2026, 10:04 AM".

---

## 11. Next Steps

1. Lock the token set in `globals.css` and generate shadcn components against it.
2. Build a `/design` route that renders every component in every state for visual regression (Chromatic or Playwright snapshots).
3. Commission or style a custom illustration set (3–5 SVGs) for empty states in the accent palette.
4. Implement the sidebar + topbar first — they set the tonal baseline the rest of the app inherits.
5. Move to Step 7 — the Tiptap editor implementation and the article viewer prose stylesheet.
