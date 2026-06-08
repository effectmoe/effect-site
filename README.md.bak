# 🌿 Acacia Studio

**Creative Digital Design Studio** — A premium agency website built with [Astro](https://astro.build), featuring smooth animations, content-driven architecture, and a refined visual identity.

🔗 **Live Site:** [acacia-studio.vercel.app](https://acacia-studio.vercel.app)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Pages & Routing](#-pages--routing)
- [Content Collections](#-content-collections)
- [Data Files (Config)](#-data-files-config)
- [Icons](#-icons)
- [Assets & Images](#-assets--images)
- [Fonts](#-fonts)
- [Component Architecture](#-component-architecture)
- [Design System](#-design-system)
- [Animations & Interactions](#-animations--interactions)
- [SEO & Performance](#-seo--performance)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🧠 Overview

Acacia Studio is a full-service digital design agency website that showcases services, case studies, blog articles, client testimonials, and a contact system. The site is designed with a **light, organic aesthetic** featuring dashed grid lines, warm tones, and premium typography.

### Key Features

- 🎨 **Light, premium design** with warm color palette and dashed-line grid system
- 📝 **Content collections** for Projects (MDX), Blog posts (MD), and Legal pages
- 📬 **Server-side contact form** with Resend email integration and honeypot protection
- 🌐 **Full SEO suite** — sitemap, RSS feed, robots.txt, Open Graph & Twitter cards
- ✨ **GSAP + Lenis** for smooth scroll and scroll-triggered animations
- 📱 **Fully responsive** with mobile-specific component variants
- 🔤 **Custom typography** — Clash Display, Space Grotesk, and Roboto Mono
- 🌍 **Centralized labels** system for easy text management and future i18n

---

## 🛠 Tech Stack

| Category             | Technology                                                                |
| :------------------- | :------------------------------------------------------------------------ |
| **Framework**        | [Astro v6](https://astro.build) (SSR mode)                                |
| **Styling**          | [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`        |
| **Animations**       | [GSAP v3](https://gsap.com) + [Lenis](https://lenis.darkroom.engineering) |
| **Content**          | Astro Content Collections (MD / MDX)                                      |
| **Email**            | [Resend](https://resend.com)                                              |
| **Rate Limiting**    | [Upstash Redis](https://upstash.com) _(prepared, currently disabled)_     |
| **Icons**            | [astro-icon](https://github.com/natemoo-re/astro-icon) (local SVGs)       |
| **Image Processing** | [Sharp](https://sharp.pixelplumbing.com)                                  |
| **Deployment**       | [Vercel](https://vercel.com) via `@astrojs/vercel`                        |
| **Package Manager**  | [pnpm](https://pnpm.io)                                                   |
| **Formatting**       | [Prettier](https://prettier.io) + astro & tailwind plugins                |

---

## 📁 Project Structure

```
acacia/
├── public/
│   ├── favicon.svg
│   └── rss/                    # RSS stylesheet
├── src/
│   ├── actions/
│   │   └── index.ts            # Server actions (contact form with Resend)
│   ├── assets/
│   │   ├── about.webp
│   │   ├── blog/               # Blog hero images
│   │   ├── fonts/              # Local font files (woff2)
│   │   ├── process/            # Process section images
│   │   ├── services/           # Service section images
│   │   └── works/              # Project cover images
│   ├── components/
│   │   ├── common/             # Shared components (BaseHead, GlobalPartners, MarqueeText, SlugMoreItems)
│   │   ├── sections/           # Page-specific sections
│   │   │   ├── blog/           # BlogCard, BlogContent, BlogSlugHeader, BlogSlugContent
│   │   │   ├── contact/        # ContactContent, ContactForm, ContactInfo, Faqs
│   │   │   ├── home/           # Hero, About, Services, Process, Works, Testimonials, Blogs
│   │   │   └── works/          # WorksCard, WorksContent, WorkSlugContent
│   │   └── ui/                 # Reusable UI primitives
│   │       ├── Button.astro    # CVA-powered polymorphic button
│   │       ├── Footer.astro
│   │       └── nav/            # Navbar + FullscreenMenu
│   ├── config/                 # Data files & centralized labels
│   │   ├── labels.ts           # All UI text strings (i18n-ready)
│   │   ├── navItems.data.ts    # Navigation & footer links
│   │   ├── socialLinks.data.ts # Social media links & contact info
│   │   ├── clients.data.ts     # Client logos & categories
│   │   ├── services.data.ts    # Service cards data
│   │   ├── process.data.ts     # Work process steps data
│   │   ├── testimonials.data.ts# Client testimonials & stats
│   │   └── faq.data.ts         # FAQ items
│   ├── content/                # Content collections (MD/MDX)
│   │   ├── blogs/              # Blog posts (Markdown)
│   │   ├── projects/           # Case studies (MDX)
│   │   └── legals/             # Legal pages (terms, privacy, licensing)
│   ├── content.config.ts       # Collection schemas (Zod validation)
│   ├── icons/                  # Local SVG icons
│   │   ├── logo-brands/        # Client & project brand logos
│   │   └── socials/            # Social media icons
│   ├── layouts/
│   │   └── Layout.astro        # Global layout (head, navbar, footer, Lenis + GSAP init)
│   ├── lib/
│   │   ├── utils.ts            # cn() helper + t() translation function
│   │   └── related.ts          # Related items algorithm (circular prev/next)
│   ├── pages/
│   │   ├── index.astro         # Home page
│   │   ├── contact.astro       # Contact page
│   │   ├── 404.astro           # Custom 404 page
│   │   ├── [legals].astro      # Dynamic legal pages
│   │   ├── robot.txt.ts        # Dynamic robots.txt endpoint
│   │   ├── rss.xml.ts          # RSS feed endpoint
│   │   ├── blog/
│   │   │   ├── index.astro     # Blog listing
│   │   │   └── [slug].astro    # Blog detail (prerendered)
│   │   └── works/
│   │       ├── index.astro     # Works listing
│   │       └── [slug].astro    # Work detail (prerendered)
│   └── styles/
│       ├── global.css          # Tailwind imports, theme tokens, Lenis styles, grid separators
│       ├── content-style.css   # Prose styling for MD/MDX rendered content
│       └── inputs.css          # Form input, textarea, label, error styles
├── astro.config.mjs            # Astro config (SSR, fonts, integrations)
├── tsconfig.json               # TypeScript with `@/*` path alias
├── package.json
├── pnpm-workspace.yaml
├── .prettierrc                 # Prettier config with Astro & Tailwind plugins
├── .env.template               # Required environment variables
├── .gitignore
└── LICENSE                     # Commercial Use Restricted License
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22.12.0
- **pnpm** (recommended package manager)

### Installation

```bash
# Clone the repository
unzip acacia-studio.zip
cd acacia-studio/acacia

# Install dependencies
pnpm install

# Set up environment variables
cp .env.template .env
# Fill in the required values (see Environment Variables section)

# Start development server
pnpm dev
```

### Commands

| Command          | Action                                        |
| :--------------- | :-------------------------------------------- |
| `pnpm install`   | Install dependencies                          |
| `pnpm dev`       | Start dev server at `localhost:4321`          |
| `pnpm build`     | Build production site to `./dist/`            |
| `pnpm preview`   | Preview the production build locally          |
| `pnpm astro ...` | Run Astro CLI commands (`add`, `check`, etc.) |

---

## 🔐 Environment Variables

Create a `.env` file based on `.env.template`:

```env
# Email Configuration (Resend)
FROM_EMAIL=               # Recipient email address
RESEND_EMAIL=             # Sender email (verified in Resend)
RESEND_API_KEY=           # Resend API key

# Site URL
SITE=                     # Production URL (e.g., https://acacia-studio.vercel.app)

# Rate Limiting (Upstash Redis) — currently disabled
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

> **Note:** The Upstash Redis rate limiting is implemented but currently commented out in `src/actions/index.ts`. To enable it, uncomment the Redis-related code and provide valid Upstash credentials.

---

## 📄 Pages & Routing

| Route                | File                       | Rendering   | Description                        |
| :------------------- | :------------------------- | :---------- | :--------------------------------- |
| `/`                  | `pages/index.astro`        | SSR         | Home page with all sections        |
| `/works`             | `pages/works/index.astro`  | SSR         | Works listing (sorted by date)     |
| `/works/[slug]`      | `pages/works/[slug].astro` | Prerendered | Individual case study              |
| `/blog`              | `pages/blog/index.astro`   | SSR         | Blog listing (sorted by date)      |
| `/blog/[slug]`       | `pages/blog/[slug].astro`  | Prerendered | Individual blog post with TOC      |
| `/contact`           | `pages/contact.astro`      | SSR         | Contact form + FAQ section         |
| `/[legals]`          | `pages/[legals].astro`     | Prerendered | Legal pages (terms, privacy, etc.) |
| `/404`               | `pages/404.astro`          | SSR         | Custom 404 page                    |
| `/rss.xml`           | `pages/rss.xml.ts`         | SSR         | RSS feed for blog posts            |
| `/robot.txt`         | `pages/robot.txt.ts`       | SSR         | Dynamic robots.txt                 |
| `/sitemap-index.xml` | Auto-generated             | —           | XML sitemap via `@astrojs/sitemap` |

> The project uses **hybrid rendering**: pages are SSR by default (`output: 'server'`), while dynamic content pages (`[slug]`, `[legals]`) use `export const prerender = true` for static generation at build time.

---

## 📚 Content Collections

Defined in `src/content.config.ts` with Zod schemas:

### Projects (`src/content/projects/*.mdx`)

| Field         | Type       | Required | Description                        |
| :------------ | :--------- | :------- | :--------------------------------- |
| `title`       | `string`   | ✅       | Project name                       |
| `description` | `string`   | ✅       | Short project description          |
| `coverImage`  | `image()`  | ✅       | Cover image (optimized by Astro)   |
| `tags`        | `string[]` | ✅       | Technology/category tags           |
| `date`        | `Date`     | ✅       | Project date                       |
| `client`      | `string`   | ❌       | Client name                        |
| `clientLink`  | `url`      | ❌       | Client website URL                 |
| `featured`    | `boolean`  | ❌       | Show on home page (default: false) |
| `icon`        | `string`   | ❌       | Icon name from `src/icons/`        |

### Blogs (`src/content/blogs/*.md`)

| Field         | Type       | Required | Description                    |
| :------------ | :--------- | :------- | :----------------------------- |
| `title`       | `string`   | ✅       | Article title                  |
| `description` | `string`   | ✅       | Article excerpt                |
| `heroImage`   | `image()`  | ✅       | Hero image                     |
| `topics`      | `string[]` | ✅       | Topic tags                     |
| `pubDate`     | `Date`     | ✅       | Publication date               |
| `author`      | `string`   | ✅       | Author name                    |
| `readingTime` | `string`   | ✅       | Estimated reading time         |
| `featured`    | `boolean`  | ❌       | Featured flag (default: false) |

### Legals (`src/content/legals/*.md`)

| Field         | Type     | Required | Description      |
| :------------ | :------- | :------- | :--------------- |
| `title`       | `string` | ✅       | Page title       |
| `description` | `string` | ✅       | Meta description |

### Adding New Content

**New Project:**

```bash
# Create a new .mdx file
touch src/content/projects/my-project.mdx
```

```mdx
---
title: 'Project Name'
description: 'A brief description of the project.'
coverImage: '../../assets/works/my-project-cover.webp'
tags: ['Web Design', 'Branding']
date: 2026-03-01
client: 'Client Name'
clientLink: 'https://client-website.com'
featured: true
icon: 'logo-brands/client-logo'
---

Your MDX content here with components...
```

**New Blog Post:**

```bash
touch src/content/blogs/my-article.md
```

```md
---
title: 'Article Title'
description: 'A compelling description.'
heroImage: '../../assets/blog/my-article-hero.webp'
topics: ['Design', 'Strategy']
pubDate: 2026-03-15
author: 'Author Name'
readingTime: '5 min read'
featured: false
---

Your markdown content here...
```

---

## 📦 Data Files (Config)

All site data is centralized in `src/config/`. Each `.data.ts` file exports typed arrays or objects that feed the components. To modify site content (services, process steps, testimonials, etc.), simply edit the corresponding data file — no component changes needed.

### `labels.ts` — All UI Text

Centralized string map for every text shown on the site. Organized by page/section using dot-notation keys:

```typescript
export const labels = {
  'company.name': 'Acacia Studio',
  'index.hero.h1': 'Creative Digital, Design Studio.',
  'meta.index.title': 'Acacia Studio',
  // ... 100+ keys organized by section
} as const;
```

**How to modify:** Edit a value in place. The key must match what components reference via `t('key.name')`. To add a new string, add a key-value pair and use `t('your.new.key')` in your component.

---

### `navItems.data.ts` — Navigation & Footer Links

Defines the main navigation and footer link items:

```typescript
export const navItems: NavItem[] = [
  { title: 'Home', href: '/' },
  { title: 'Works', href: '/works' },
  { title: 'Blog', href: '/blog' },
  { title: 'Contact', href: '/contact' },
];

export const footerOtherItems: NavItem[] = [
  { title: 'Term of Use', href: '/terms-of-service' },
  // ...
];
```

**How to modify:** Add or remove objects from the arrays. Each item needs a `title` (display text) and `href` (route path).

---

### `socialLinks.data.ts` — Social Media & Contact Info

Contains two exports:

- **`socialLinks`** — Social media platforms with icon references
- **`contactInfo`** — Office address, email, phone, and working hours

```typescript
export const socialLinks: SocialLink[] = [
  { href: 'https://www.instagram.com/', label: 'Instagram', icon: 'instagram' },
  // ...
];

export const contactInfo: ContactInfo = {
  address: { street: '...', city: '...', country: '...' },
  email: 'hello@acacia.studio',
  phone: '(+000) 111 222 333',
  workingHours: 'Monday - Friday | 9AM - 5PM',
  workingDays: 'Sat-Sun: Closed',
};
```

**How to modify:** Update URLs, labels, and contact details directly. The `icon` field references an SVG filename inside `src/icons/socials/` (without the `.svg` extension).

---

### `services.data.ts` — Service Cards

Defines the four service offerings shown on the home page. Each service includes an image imported from `src/assets/services/`:

```typescript
export const services: Service[] = [
  {
    id: '01',
    title: 'Design',
    description: 'Design web that fuses aesthetics and functionality...',
    tags: ['UI/UX Design', 'Responsive', 'Prototyping'],
    image: img1, // imported from @/assets/services/design.webp
  },
  // ...
];
```

**How to modify:** Edit titles, descriptions, and tags. To change an image, replace the `.webp` file in `src/assets/services/` or update the import path.

---

### `process.data.ts` — Work Process Steps

Four steps of the design/development process, each with keywords and an image:

```typescript
export const process: Process[] = [
  {
    num: '01',
    title: 'Discovery & Strategy',
    description: 'Understanding your goals, pain points, audience...',
    image: img1, // imported from @/assets/process/img01.webp
    keywords: ['WORKFLOW AUDITS', 'MARKET RESEARCH', 'COMPETITOR ANALYSIS', 'STRATEGIC PLANNING'],
  },
  // ...
];
```

**How to modify:** Update step titles, descriptions, keywords, or swap images in `src/assets/process/`.

---

### `clients.data.ts` — Client Logos

Client categories with references to SVG logos in `src/icons/logo-brands/`:

```typescript
export const clients: Client[] = [
  { category: 'Real Estate', logo: 'logoipsum-1' },
  { category: 'E-Commerce', logo: 'logoipsum-2' },
  // ...
];
```

**How to modify:** The `logo` field maps to `src/icons/logo-brands/{logo}.svg`. Add a new SVG file and a new entry to the array.

---

### `testimonials.data.ts` — Testimonials & Stats

Two exports:

- **`testimonials`** — Client quotes with author info
- **`stats`** — Numerical statistics displayed alongside testimonials

```typescript
export const testimonials: Testimonial[] = [
  {
    id: 1,
    quote: 'Acacia revamped our website and branding...',
    author: 'Joe Glodberg',
    role: 'CEO',
    company: 'Larch Agency',
  },
  // ...
];

export const stats: Stat[] = [
  { num: '10', suffix: '+', label: 'WORKFLOWS AUTOMATED' },
  // ...
];
```

---

### `faq.data.ts` — FAQ Items

Question-answer pairs displayed on the contact page:

```typescript
export const faqs: FAQ[] = [
  {
    question: "What's your typical process for a new project?",
    answer: 'We start with a discovery phase...',
  },
  // ...
];
```

**How to modify:** Add or edit objects in the array. Each needs a `question` and `answer` string.

---

## 🎯 Icons

Icons are managed locally using [astro-icon](https://github.com/natemoo-re/astro-icon) with SVG files stored in `src/icons/`. The directory structure determines the icon name used in components:

```
src/icons/
├── logo-brands/          # Client & project brand logos
│   ├── banyan-logo.svg
│   ├── cipres-agency-logo.svg
│   ├── cipres-energy-logo.svg
│   ├── larch-logo.svg
│   ├── olmo-logo.svg
│   └── logoipsum-{1-6}.svg   # Placeholder partner logos
├── socials/              # Social media icons
│   ├── facebook.svg
│   ├── instagram.svg
│   ├── linkedin.svg
│   └── x.svg
├── arrow.svg             # General UI icons
├── asterisk.svg
├── chevron.svg
├── globe.svg
├── menu.svg
├── plus.svg
├── spin.svg
└── world.svg
```

### How to Use Icons

In any Astro component:

```astro
---
import { Icon } from 'astro-icon/components';
---

<!-- Root-level icon -->
<Icon name="arrow" class="h-4 w-4" />

<!-- Subdirectory icon -->
<Icon name="socials/instagram" class="h-5 w-5" />
<Icon name="logo-brands/banyan-logo" class="h-8 w-auto" />
```

### Adding New Icons

1. Place your `.svg` file in `src/icons/` (root for UI icons) or in a subdirectory (`logo-brands/`, `socials/`)
2. Reference it by name: `<Icon name="filename" />` or `<Icon name="folder/filename" />`
3. The `.svg` extension is **not** included in the name

> **Convention:** Use subdirectories to group related icons. Brand logos go in `logo-brands/`, social icons in `socials/`, and general UI icons at the root level.

---

## 🖼 Assets & Images

All images are stored in `src/assets/` and imported in components or data files. Astro optimizes these images automatically at build time through the `<Image />` component and Sharp.

```
src/assets/
├── about.webp              # About section image
├── blog/                   # Blog post hero images
│   └── {blog-slug}.webp
├── fonts/                  # Local font files (see Fonts section)
├── process/                # Work process step images
│   ├── img01.webp
│   ├── img02.webp
│   ├── img03.webp
│   └── img04.webp
├── services/               # Service card images
│   ├── design.webp
│   ├── develop.webp
│   ├── mobile.webp
│   └── marketing.webp
└── works/                  # Project cover images
    └── {project-slug}/     # Each project's images
```

### How Images Are Used

**In data files** — Images are imported at the top and assigned to data objects:

```typescript
import img1 from '@/assets/services/design.webp';

export const services = [
  { title: 'Design', image: img1 },
  // ...
];
```

**In content collections** — Referenced via relative paths in frontmatter:

```mdx
---
coverImage: '../../assets/works/my-project/cover.webp'
---
```

### Adding New Images

1. Use **WebP format** for optimal performance
2. Place the image in the corresponding subdirectory (`blog/`, `works/`, `services/`, `process/`)
3. Import it in the relevant data file or reference it in content frontmatter

> **Note:** Images inside `src/assets/` are processed by Astro's image pipeline (optimization, resizing, format conversion). For static files that should not be processed, place them in `public/` instead.

For more information about images, visit [Astro Images](https://docs.astro.build/en/guides/images/)

---

## 🔤 Fonts

The project uses three custom fonts, all loaded locally from `src/assets/fonts/` via Astro's built-in font system configured in `astro.config.mjs`.

### Font Files

```
src/assets/fonts/
├── ClashDisplay-Bold.woff2          # Headings & display text
├── space-grotesk-latin-400-normal.woff2   # Body text
└── RobotoMono-Regular.woff2         # Labels, code, metadata
```

### Font Configuration (`astro.config.mjs`)

Fonts are registered using `fontProviders.local()` with the following structure:

```js
fonts: [
  {
    provider: fontProviders.local(),
    name: 'Clash-Display',
    cssVariable: '--font-clash-display', // Used in Tailwind as font-clash
    fallbacks: ['sans-serif'],
    options: {
      variants: [
        {
          weight: 700,
          style: 'normal',
          display: 'swap',
          src: ['./src/assets/fonts/ClashDisplay-Bold.woff2'],
        },
      ],
    },
  },
  // Space Grotesk (weight: 400) → --font-space-grotesk → font-grotesk
  // Roboto Mono   (weight: 400) → --font-roboto-mono   → font-mono
];
```

Each font defines:

- **`name`** — Font family name
- **`cssVariable`** — CSS custom property that Tailwind references
- **`fallbacks`** — Fallback font stack
- **`src`** — Path to the `.woff2` file in `src/assets/fonts/`
- **`display: 'swap'`** — Shows fallback text until the font loads

### Using Fonts in Tailwind

The CSS variables are aliased in `src/styles/global.css` for shorter class names:

```css
@theme inline {
  --font-clash: var(--font-clash-display);
  --font-grotesk: var(--font-space-grotesk);
  --font-mono: var(--font-roboto-mono);
}
```

Usage in components:

```html
<h1 class="font-clash">Heading</h1>
<p class="font-grotesk">Body text</p>
<span class="font-mono">Label</span>
```

### Adding a New Font

1. Place the `.woff2` file in `src/assets/fonts/`
2. Add a new entry in the `fonts` array in `astro.config.mjs`
3. Optionally create a short alias in `global.css` under `@theme inline`
4. Fonts are preloaded automatically via `<Font cssVariable="..." preload />` in `BaseHead.astro`

For more information about fonts, visit [Astro Fonts](https://docs.astro.build/en/guides/fonts/)

---

## 🧩 Component Architecture

Components are organized by scope and purpose:

### Common (`src/components/common/`)

| Component              | Purpose                                         |
| :--------------------- | :---------------------------------------------- |
| `BaseHead.astro`       | SEO meta tags, fonts, Open Graph, Twitter cards |
| `GlobalPartners.astro` | Partner logos marquee/grid                      |
| `MarqueeText.astro`    | Repeating text marquee banner                   |
| `SlugMoreItems.astro`  | "More items" section for detail pages           |

### UI (`src/components/ui/`)

| Component                  | Purpose                                                                                                             |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `Button.astro`             | Polymorphic button/link (`<a>` or `<button>`) with CVA variants: `primary`, `secondary`, `outline`, `ghost`, `none` |
| `Footer.astro`             | Site footer with CTA, navigation, social links                                                                      |
| `nav/Navbar.astro`         | Top navigation bar                                                                                                  |
| `nav/FullscreenMenu.astro` | Fullscreen mobile menu overlay                                                                                      |

### Sections (`src/components/sections/`)

Organized by page, mirroring the site structure:

- **`home/`** — Hero (with Globe animation), About, Services, Process, Works, Testimonials, Blogs
- **`works/`** — Works listing cards, Work detail content
- **`blog/`** — Blog listing cards, Blog detail header/content with table of contents
- **`contact/`** — Contact info, Contact form, FAQ accordion

---

## 🎨 Design System

### Color Tokens

Defined in `src/styles/global.css` using Tailwind's `@theme inline`:

| Token                | Value                | Usage                          |
| :------------------- | :------------------- | :----------------------------- |
| `background`         | `#eeebe4`            | Warm off-white page background |
| `foreground`         | `#0a0a0a`            | Primary text color             |
| `primary`            | `#141414`            | Buttons, headings, dark fills  |
| `primary-foreground` | `#ffffff`            | Text on primary backgrounds    |
| `surface`            | `oklch(0.269 0 0)`   | Dark surface elements          |
| `surface-light`      | `oklch(1 0 0 / 10%)` | Light overlay surfaces         |
| `muted`              | `#4b5563`            | Secondary text                 |
| `muted-foreground`   | `#9ca3af`            | Tertiary text, borders         |
| `accent`             | `#c2410c`            | Accent color (orange-red)      |

### Typography

Three custom fonts loaded locally via `astro.config.mjs`:

| Font          | CSS Variable           | Tailwind Class | Usage                  |
| :------------ | :--------------------- | :------------- | :--------------------- |
| Clash Display | `--font-clash-display` | `font-clash`   | Headings, display text |
| Space Grotesk | `--font-space-grotesk` | `font-grotesk` | Body text (default)    |
| Roboto Mono   | `--font-roboto-mono`   | `font-mono`    | Labels, code, metadata |

### Visual Identity

- **Dashed grid lines** — Fixed background with 5 vertical dashed lines (`Layout.astro`)
- **Section separators** — Automatic dashed horizontal lines between `<main>` children via CSS (`global.css`)
- **Marquee banners** — Repeating text banners for section labeling
- **Cards** — Consistent card patterns with `bg-muted-foreground/80` container, `p-0.5` padding, inner content area

---

## ✨ Animations & Interactions

### Lenis Smooth Scroll

Initialized in `Layout.astro`, providing butter-smooth scrolling:

```js
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  touchMultiplier: 2,
});
```

### GSAP ScrollTrigger

GSAP is registered with `ScrollTrigger` and synced with Lenis for scroll-triggered animations across components. The `gsap` package is excluded from SSR external bundling to avoid issues.

### Globe Animation

The hero section features a custom WebGL globe animation (`src/components/sections/home/hero/globe.ts`) rendered on canvas.

---

## 🔍 SEO & Performance

### Meta Tags

Managed through `BaseHead.astro` with support for:

- Title, description, and keywords
- Canonical URLs
- Open Graph (Facebook) tags
- Twitter Card tags
- RSS feed autodiscovery
- Sitemap reference

### Generated Endpoints

| Endpoint             | Purpose                                     |
| :------------------- | :------------------------------------------ |
| `/sitemap-index.xml` | Auto-generated XML sitemap                  |
| `/rss.xml`           | Blog RSS feed with custom XSL stylesheet    |
| `/robot.txt`         | Dynamic robots.txt (allows all, blocks 404) |

### Centralized Labels

All UI text is managed through `src/config/labels.ts` using a `t()` helper function. This pattern:

- Keeps all copy in one place for easy updates
- Enables future internationalization (i18n)
- Provides type-safe translation keys via `TranslationKey` type

```typescript
// Usage in components
import { t } from '@/lib/utils';

t('index.hero.h1'); // → "Creative Digital, Design Studio."
```

---

## 🚢 Deployment

The site is configured for **Vercel** deployment with the `@astrojs/vercel` adapter in SSR mode.

### Vercel Setup

1. Connect the repository to Vercel
2. Set the **Root Directory** to `acacia`
3. Configure environment variables in the Vercel dashboard
4. Deploy — Vercel auto-detects the Astro framework

### Build Configuration

```js
// astro.config.mjs
export default defineConfig({
  output: 'server', // SSR mode
  adapter: vercel(), // Vercel adapter
  site: siteUrl, // From SITE env var
});
```

---

## 📬 Contact Form

The contact form uses **Astro Actions** (`src/actions/index.ts`) with:

1. **Zod validation** — Name (3-30 chars), email, message (10-500 chars)
2. **Honeypot field** — Hidden `company` field to catch bots
3. **Resend integration** — Sends formatted HTML + plain text emails
4. **Rate limiting** _(prepared)_ — Upstash Redis-based IP rate limiting (currently commented out)

---

## 📝 License

**Commercial Use License** © 2026 Agustin Castets

- Permitted Use: You are granted a license to use, modify, and adapt this source code for your projects based on the license tier purchased (Personal or Agency).
- Restrictions: Redistribution, resale, or sublicensing of this template (original or modified) is strictly prohibited.
- Support: This product is provided "as-is" without technical support or guaranteed updates.

---

<div align="center">

**Built with ❤️ by [CuterDev](https://cuterdev.lemonsqueezy.com/)**

</div>
