# effect.moe 3-Layer Manga UX Redesign — Design Specification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform effect.moe from a standard blog into a 3-layer immersive manga knowledge site targeting non-IT executives, merging Instagram (discovery), TikTok (vertical browse), and Wikipedia (deep knowledge) into one seamless experience.

**Target Audience:** Non-IT C-suite / executives seeking LLMO/DX knowledge
**Design Language:** Swiss Minimal (Anti-AI standards) + dark cinema mode for manga reading
**Device Strategy:** Mobile-primary, desktop co-equal (Split Knowledge View)

---

## Architecture Overview

```
Notion (Source of Truth)
  ├─ Clusters DB  ── topic grouping, pillar articles
  ├─ Articles DB  ── metadata, slug, audio, LLM text, cluster relation
  └─ Panels DB   ── per-panel image, order, transcript, AI context
         │
    n8n sync (scheduled)
         │
    D1 (Primary Read DB — normalized, relational queries)
         │
    KV (Edge Cache — 5min TTL, stale-while-revalidate)
         │
    Workers SSR (React Router 7)
         │
    3-Layer UI
```

### URL Structure

| Layer | Route | Purpose |
|-------|-------|---------|
| Grid (Discovery) | `/` | Cluster-grouped article tiles |
| Cluster Hub | `/clusters/:id` | Pillar page + learning roadmap |
| Timeline (Vertical) | `/articles/:slug` | Full-screen article covers, vertical snap |
| Manga Reader (Horizontal) | `/articles/:slug/p:page` | Panel-by-panel reading, deep-linkable |

### Notion Database Schema

**Clusters DB:**
- Name (Title)
- Pillar Article (Relation → Articles)
- Description (Text) — AI reads this to understand topic boundaries
- Status (Select: Draft / Active / Complete)

**Articles DB (existing, extended):**
- Title, Slug, Description, Category, Tags (existing)
- Cluster (Relation → Clusters) — NEW
- Order in Cluster (Number) — NEW
- Global LLM Text (Rich Text) — comprehensive expert text for LLMO — NEW
- Audio File (Files & Media) — narration audio — NEW
- Audio Anchors (Code/JSON) — `[{panel: 1, start: 0, end: 15.2}, ...]` — NEW
- Cover Panel (Relation → Panels) — first panel image — NEW

**Panels DB (new):**
- Panel Image (Files & Media)
- Order (Number)
- Transcript / Dialogue (Text) — searchable text of speech bubbles
- AI Context (Text) — scene description for LLMO
- Parent Article (Relation → Articles)

---

## Section 1: Discovery Layer — The Grid (`/`)

### Mobile (2-column grid)

- Square tiles showing panel 1 image as cover
- Below image: series number label (`#01`, text-xs font-mono text-gray-400), article title (text-sm font-semibold, max 2 lines), cluster name (text-xs text-gray-500)
- 8px gaps between cards, no shadows — border-gray-100 only
- Grouped by cluster: cluster header = cluster name (text-base font-semibold) + article count (text-xs text-gray-400) + thin top border
- Cluster headers link to `/clusters/:id`
- Read status: read cards have slightly reduced opacity (opacity-75) + small check icon (Lucide `check`, 12px, text-gray-400) on the cover
- Clusters ordered by most recently updated
- Tap card → navigate to `/articles/:slug`

### Desktop (4-column grid, max-w-6xl centered)

- Cards expand on hover (duration-200 ease-in-out): cover scales to 1.02, 2-line description fades in below title
- Left sidebar (w-64, sticky): vertical cluster nav list. Active cluster = border-l-2 border-blue-600. Click smooth-scrolls to section.

### Empty State

Centered typography only: "Knowledge base under construction. First manga coming soon." No decorative elements.

---

## Section 2: Timeline Layer — Vertical Snap (`/articles/:slug`)

### Mobile

- Full viewport height (`h-dvh`), CSS `scroll-snap-type: y mandatory`
- Each snap section:
  1. Cover image (panel 1) — ~65% screen height, object-fit cover, no rounded corners
  2. Bottom text band (solid off-white, not glass): cluster name (text-xs uppercase tracking-wide text-gray-500), article title (text-xl font-semibold text-gray-900), series number (#01 of 8, text-sm text-gray-400)
  3. Right-edge affordance: thin vertical line (w-0.5 h-16 bg-gray-300) + chevron-right icon (16px, text-gray-400)
  4. Audio teaser: play button (rounded-full, 32px, border border-gray-200) near title
- Bounce on entry: micro-bounce animation toward right on snap settle (translateX 4px → 0, duration-300)
- First article: "Scroll down" hint (text-xs text-gray-400 + chevron-down icon)
- URL updates on snap settle to next article's `/articles/:slug`

### Desktop

- Centered card layout (max-w-2xl), mouse wheel snaps between articles
- Cover at fixed 4:3 aspect ratio
- Keyboard: up/down arrows navigate

---

## Section 3: Manga Reader — Horizontal Swipe (`/articles/:slug/p:page`)

### The Transition (Vertical → Horizontal) — 300ms total

1. **Collapse (0-100ms):** Bottom text band slides down + fades. Cover image expands to fill viewport. Background transitions from off-white to `bg-gray-950` (dark).
2. **Axis Shift (100-200ms):** Expanded cover slides left to panel 1 position in horizontal Swiper. Progress bar (h-0.5, bg-gray-700) appears at top. URL updates to `/articles/:slug/p1`.
3. **Reveal (200-300ms):** Panel 2 peeks from right edge (~16px). Audio mini-player fades in at bottom.

All via CSS transforms (`translateX`, `scale`), no layout reflows. `ease-in-out` throughout.

**Exit:** Swipe left past panel 1 reverses animation — image shrinks, text band rises, background returns to off-white, URL reverts to `/articles/:slug`.

### Mobile Manga Reader

- Full-screen horizontal Swiper (`scroll-snap-type: x mandatory`)
- Each panel fills viewport, `bg-gray-950` background
- **Top overlay:** Segmented progress bar (h-0.5). Active segment = white, others = gray-700. Tap segment to jump.
- **Bottom overlay:** Audio mini-player strip (h-12, bg-gray-900):
  - Play/pause button
  - Panel counter ("3 / 8")
  - Waveform indicator showing audio position relative to panel anchors
  - Swipe up on strip → expand to show panel transcript (accessibility)
- **No other chrome.** No header, no footer, no hamburger. Pure manga.
- URL updates per panel: `/p1` → `/p2` → `/p3`

### Smart Anchor Synchronization

- **Swipe-to-Seek:** Swipe to panel N → `audio.currentTime` jumps to panel N's start timestamp
- **Play-to-Swipe (auto-mode):** Toggle icon on audio strip. When active, reaching next panel's timestamp auto-advances Swiper. Progress bar segment pulses before transition.
- **Manual Override:** User swipe during auto-mode pauses auto-advance immediately. Resumes only on explicit re-toggle.

### Desktop — Split Knowledge View

- **Left pane (60%):** Swiper manga viewer on `bg-gray-950`. Panel images at natural aspect ratio, centered. Left/right arrow keys navigate. Clickable prev/next zones at pane edges.
- **Right pane (40%):** `bg-stone-50` scrollable text. Auto-syncs to current panel: shows panel transcript, AI context, and matching section of Global LLM Text. Smooth-scrolls on panel change.
- **Spine (between panes, w-12):** Vertical audio player — waveform + play/pause. Visually connects panes like a book binding.

### The Final Panel (Knowledge Landing)

After last manga panel, one more horizontal swipe reveals:

- Background transitions from dark to off-white
- Article summary: 2-3 paragraphs of Global LLM Text (expert-level)
- "Next in this series" card → next article in cluster (by Order in Cluster)
- "Explore this topic" link → `/clusters/:id`
- Related articles from same cluster (horizontal scroll of small cards)
- Full transcript of all panel dialogues (collapsed, expandable) — visible to users and AI crawlers

---

## Section 4: LLMO / Semantic Layer

### JSON-LD per route

- `/` — WebSite + ItemList (articles)
- `/clusters/:id` — CollectionPage + ItemList + BreadcrumbList
- `/articles/:slug` — Article + HowTo (for tutorial content) + BreadcrumbList + AudioObject
- `/articles/:slug/p:page` — WebPage (panel-specific) with ImageObject + transcript text

### SSR HTML structure

Every page renders full semantic HTML server-side. The manga panels are rendered as `<img>` tags with comprehensive `alt` attributes (from Panel AI Context). Panel transcripts are rendered in `<article>` sections below the visual content — visible to both users (on Knowledge Landing) and crawlers.

### X-AI-Context header

Each route includes cluster context, article position in cluster, and panel count in the response header.

### llms.txt

Updated to include cluster structure and article hierarchy.

---

## Section 5: Design Tokens

### Colors

```
Background (light):    bg-stone-50     (#FAFAF9)
Background (dark):     bg-gray-950     (#030712)
Audio strip:           bg-gray-900     (#111827)
Text primary:          text-gray-900   (#171717)
Text secondary:        text-gray-500   (#6B7280)
Text on dark:          text-gray-100   (#F3F4F6)
Accent primary:        text-blue-600   (#2563EB)
Accent secondary:      text-blue-400   (#60A5FA) — dark mode only
Border:                border-gray-100 (#F3F4F6) / border-gray-200 (#E5E7EB)
Progress inactive:     bg-gray-700     (#374151)
Progress active:       bg-white        (#FFFFFF)
```

### Typography

```
Font stack: 'Inter', 'Noto Sans JP', system-ui, sans-serif
Heading 1:    text-xl  font-semibold  (article titles in timeline)
Heading 2:    text-base font-semibold (cluster headers, section titles)
Body:         text-sm  font-normal    leading-relaxed
Caption:      text-xs  font-normal    text-gray-500
Series label: text-xs  font-mono      text-gray-400
```

### Spacing (8px grid)

```
Card gap:          gap-2    (8px)
Card padding:      p-0      (edge-to-edge images)
Section spacing:   py-12    (48px)
Sidebar width:     w-64     (256px)
Audio strip:       h-12     (48px)
Progress bar:      h-0.5    (2px)
```

### Animation

```
All transitions:   duration-200 ease-in-out (default)
Layer transition:  duration-300 ease-in-out (vertical → horizontal)
Micro-bounce:      duration-300 ease-in-out (translateX 4px → 0)
Hover scale:       scale-[1.02] duration-200 ease-in-out
```

---

## Section 6: Component Tree

```
app/
  components/
    grid/
      article-card.tsx        — Square tile with cover, title, series #, read status
      cluster-section.tsx     — Cluster header + card grid
      cluster-sidebar.tsx     — Desktop sticky nav
    timeline/
      timeline-view.tsx       — Vertical snap container
      article-cover.tsx       — Full-viewport cover snap section
      swipe-affordance.tsx    — Right-edge indicator + bounce
    manga/
      manga-reader.tsx        — Horizontal Swiper container + transition logic
      panel-slide.tsx         — Single panel viewport
      progress-bar.tsx        — Segmented panel progress
      audio-player.tsx        — Mini-player strip + waveform
      audio-sync.tsx          — Smart Anchor Sync logic (hook)
      knowledge-landing.tsx   — Final panel: summary, next article, transcript
    split-view/
      split-layout.tsx        — Desktop 60/40 pane container
      text-pane.tsx           — Right pane: synced transcript + context
      spine-player.tsx        — Vertical audio strip between panes
    shared/
      json-ld.tsx             — Existing (enhanced with new schemas)
      header.tsx              — Minimal, hides in manga reader
      footer.tsx              — Minimal
      chat-widget.tsx         — Existing
  hooks/
    use-audio-sync.ts         — Audio ↔ Swiper bidirectional sync
    use-read-status.ts        — localStorage-based read tracking
    use-scroll-snap.ts        — Snap detection + URL sync
  lib/
    notion.server.ts          — Extended: clusters, panels, audio anchors
    d1.server.ts              — D1 query layer for clusters/articles/panels
    cache.server.ts           — Existing
    jsonld.ts                 — Extended with new schema types
  routes/
    _index.tsx                — Grid (Discovery Layer)
    clusters.$id.tsx          — Cluster Hub (pillar page)
    articles.$slug.tsx        — Timeline (Vertical Layer)
    articles.$slug.p$page.tsx — Manga Reader (Horizontal Layer)
```

---

## Section 7: Technology Stack Additions

| Package | Purpose | Why |
|---------|---------|-----|
| swiper | Horizontal manga carousel | Industry standard, touch-optimized, CSS snap support |
| lucide-react | Icons | Minimal, tree-shakeable, Swiss-compatible |

No additional animation libraries. All transitions via CSS transforms + Tailwind utilities. No Framer Motion (keeps bundle minimal for Workers).

---

## Section 8: Implementation Phases

### Phase A: Data Layer (Backend)
1. Create Clusters DB and Panels DB in Notion
2. Extend Articles DB with new properties
3. Add D1 migration for clusters, articles (extended), panels tables
4. Build n8n workflow: Notion → D1 sync
5. Extend `notion.server.ts` / create `d1.server.ts` for new queries
6. Update KV cache layer for new data types

### Phase B: Grid + Timeline (Frontend Core)
1. Implement article-card, cluster-section, cluster-sidebar components
2. Rebuild `_index.tsx` as cluster-grouped grid
3. Implement timeline-view with vertical snap scroll
4. Create `articles.$slug.tsx` as timeline route
5. Add `clusters.$id.tsx` pillar page
6. Read status tracking (localStorage hook)

### Phase C: Manga Reader (Frontend Immersive)
1. Implement manga-reader with horizontal Swiper
2. Build the 300ms vertical→horizontal transition
3. Create `articles.$slug.p$page.tsx` route with URL sync
4. Panel progress bar + segmented navigation
5. Audio player + Smart Anchor Sync (use-audio-sync hook)
6. Desktop Split Knowledge View (split-layout, text-pane, spine-player)
7. Knowledge Landing (final panel)

### Phase D: LLMO + Polish
1. Enhanced JSON-LD per route type
2. Updated llms.txt with cluster hierarchy
3. X-AI-Context headers with cluster context
4. Accessibility audit (alt texts from AI Context, keyboard nav, screen reader)
5. Performance optimization (image lazy loading, audio preload strategy)
