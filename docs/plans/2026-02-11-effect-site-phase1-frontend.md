# effect-site Phase 1 前半 (Task 1-4) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the effect-site (effect.moe) foundation — React Router 7 + Cloudflare Pages skeleton, Notion CMS integration for LLMO/DX blog articles, AI crawler detection Worker, and llms.txt/JSON-LD auto-generation.

**Architecture:** React Router 7 with SSR on Cloudflare Pages. Notion as headless CMS for article content. Cloudflare Workers middleware detects AI crawlers (GPTBot, Claude-Web, etc.) and logs to D1. Each page auto-generates JSON-LD structured data. A dedicated `/llms.txt` endpoint serves AI-readable site summary.

**Tech Stack:** React Router 7, Cloudflare Pages/Workers/D1/KV, Tailwind CSS v4, Notion API (`@notionhq/client`), TypeScript strict mode

**Reference project:** `~/projects/dental-sparkle-remix/` (proven RR7 + Cloudflare + Notion patterns)

**Critical rules:**
- Git commit messages MUST be ASCII-only (no emoji, no Japanese) — Cloudflare Pages deploy fails on non-ASCII
- Cloudflare bindings (D1, KV) are configured in Dashboard, NOT via CLI
- SSR enabled, no prerender

---

## Task 1: React Router 7 + Cloudflare Pages Skeleton

### Step 1: Create GitHub repository

```bash
cd ~/projects/effect-site
gh repo create tonychustudio/effect-site --public --source=. --push=false
```

If repo already exists, skip. We'll push after project init.

### Step 2: Initialize React Router 7 project

```bash
cd ~/projects
npx create-react-router@latest effect-site --template cloudflare
```

If `~/projects/effect-site` already has the plan docs, move them out first, init, then move back:

```bash
mv ~/projects/effect-site/docs /tmp/effect-site-docs
npx create-react-router@latest effect-site --template cloudflare
mv /tmp/effect-site-docs ~/projects/effect-site/docs
```

Select: Cloudflare template, TypeScript, install dependencies.

### Step 3: Install additional dependencies

```bash
cd ~/projects/effect-site
npm install @notionhq/client
npm install -D tailwindcss @tailwindcss/vite
```

### Step 4: Configure wrangler.toml

**File:** `wrangler.toml`

Replace the generated wrangler.toml with:

```toml
name = "effect-site"
compatibility_date = "2025-12-30"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./build/client"

[[d1_databases]]
binding = "DB"
database_name = "effect-site-db"
database_id = "PLACEHOLDER_CREATE_IN_DASHBOARD"

[[kv_namespaces]]
binding = "CACHE"
id = "PLACEHOLDER_CREATE_IN_DASHBOARD"

[vars]
SITE_NAME = "effect.moe"
SITE_URL = "https://effect.moe"
NOTION_DATABASE_ARTICLES = "PLACEHOLDER_NOTION_DB_ID"

[dev]
port = 8788
```

Note: D1 database_id and KV id will be filled after creating resources in Cloudflare Dashboard.

### Step 5: Configure Tailwind CSS v4

**File:** `app/app.css`

```css
@import "tailwindcss";
```

**File:** `vite.config.ts` — add Tailwind plugin:

```typescript
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
});
```

### Step 6: Create TypeScript types for Cloudflare bindings

**Create:** `app/types/env.ts`

```typescript
export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  SITE_NAME: string;
  SITE_URL: string;
  NOTION_DATABASE_ARTICLES: string;
  NOTION_API_KEY: string;
}
```

**Modify:** `app/root.tsx` — ensure it uses the env type in loaders if needed.

### Step 7: Create basic layout structure

**Create:** `app/components/header.tsx`

```tsx
import { Link } from "react-router";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-xl font-bold text-gray-900">
          effect.moe
        </Link>
        <nav className="flex gap-6 text-sm text-gray-600">
          <Link to="/" className="hover:text-gray-900">Home</Link>
          <Link to="/articles" className="hover:text-gray-900">Articles</Link>
          <Link to="/about" className="hover:text-gray-900">About</Link>
        </nav>
      </div>
    </header>
  );
}
```

**Create:** `app/components/footer.tsx`

```tsx
export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} effect.moe — LLMO & DX Media</p>
      </div>
    </footer>
  );
}
```

### Step 8: Update root layout

**Modify:** `app/root.tsx`

Wrap the `<Outlet />` with Header and Footer components:

```tsx
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";

// In the Layout component:
<Header />
<main className="mx-auto max-w-5xl px-4 py-8">
  <Outlet />
</main>
<Footer />
```

### Step 9: Create route stubs

**Modify:** `app/routes/_index.tsx` (homepage)

```tsx
import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "effect.moe — LLMO & DX Media" },
    { name: "description", content: "AI時代のWebマーケティングを再定義する LLMO & DX メディア" },
  ];
}

export default function Index() {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">effect.moe</h1>
      <p className="text-lg text-gray-600">
        LLMO (Large Language Model Optimization) & DX に特化したメディアサイト
      </p>
    </div>
  );
}
```

**Create:** `app/routes/articles._index.tsx`

```tsx
import type { Route } from "./+types/articles._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Articles — effect.moe" }];
}

export default function ArticleList() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Articles</h1>
      <p className="text-gray-500">Coming soon...</p>
    </div>
  );
}
```

**Create:** `app/routes/articles.$slug.tsx`

```tsx
import type { Route } from "./+types/articles.$slug";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Article — effect.moe` }];
}

export default function ArticleDetail({ params }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Article: {params.slug}</h1>
      <p className="text-gray-500">Content loading...</p>
    </div>
  );
}
```

**Create:** `app/routes/about.tsx`

```tsx
export function meta() {
  return [
    { title: "About — effect.moe" },
    { name: "description", content: "effect.moeについて" },
  ];
}

export default function About() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">About</h1>
      <p className="text-gray-600">
        effect.moe は LLMO & DX に特化したメディアサイトです。
        AI検索時代のWebマーケティング手法を研究・発信しています。
      </p>
    </div>
  );
}
```

### Step 10: Verify local dev works

```bash
cd ~/projects/effect-site
npm run dev
```

Expected: Dev server starts on http://localhost:5173 (or similar). Pages render with header/footer.

### Step 11: Create .claude/rules for effect-site

**Create:** `~/projects/effect-site/.claude/rules/commit-rules.md`

```markdown
## Git Commit Rules
- Commit messages MUST be ASCII-only (no emoji, no Japanese)
- Cloudflare Pages deploy rejects non-ASCII commit messages
- Use conventional commits: feat:, fix:, chore:, docs:
```

### Step 12: Initialize git and first commit

```bash
cd ~/projects/effect-site
git init
git add -A
git commit -m "feat: initialize React Router 7 + Cloudflare Pages skeleton"
git remote add origin https://github.com/tonychustudio/effect-site.git
git branch -M main
git push -u origin main
```

### Step 13: Deploy to Cloudflare Pages

```bash
cd ~/projects/effect-site
npm run build
wrangler pages project create effect-site --production-branch main
wrangler pages deploy ./build/client
```

Expected: Deployed to `effect-site.pages.dev`. Verify pages load.

---

## Task 2: Notion CMS Integration

### Step 1: Create Notion article database

Create a Notion database for effect-site articles with these properties:

| Property | Type | Purpose |
|----------|------|---------|
| Title | title | Article title |
| Slug | rich_text | URL slug (e.g., "what-is-llmo") |
| Content | (page body) | Article body in Notion blocks |
| Category | select | LLMO / DX / AI / Tutorial |
| Tags | multi_select | Fine-grained tags |
| Published | checkbox | Whether article is live |
| PublishedAt | date | Publication date |
| Description | rich_text | Meta description / excerpt |
| CoverImage | files | OG image / hero image |

Use Notion MCP to create this database. Record the database ID for wrangler.toml.

### Step 2: Create Notion server utility

**Create:** `app/lib/notion.server.ts`

```typescript
import { Client } from "@notionhq/client";
import type { Env } from "~/types/env";

let notionClient: Client | null = null;

function getNotion(env: Env): Client {
  if (!notionClient) {
    notionClient = new Client({ auth: env.NOTION_API_KEY });
  }
  return notionClient;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  coverImage: string | null;
}

export async function getArticles(env: Env): Promise<Article[]> {
  const notion = getNotion(env);
  const response = await notion.databases.query({
    database_id: env.NOTION_DATABASE_ARTICLES,
    filter: {
      property: "Published",
      checkbox: { equals: true },
    },
    sorts: [
      { property: "PublishedAt", direction: "descending" },
    ],
  });

  return response.results.map(pageToArticle);
}

export async function getArticleBySlug(env: Env, slug: string): Promise<Article | null> {
  const notion = getNotion(env);
  const response = await notion.databases.query({
    database_id: env.NOTION_DATABASE_ARTICLES,
    filter: {
      and: [
        { property: "Slug", rich_text: { equals: slug } },
        { property: "Published", checkbox: { equals: true } },
      ],
    },
  });

  if (response.results.length === 0) return null;
  return pageToArticle(response.results[0]);
}

export async function getArticleContent(env: Env, pageId: string): Promise<string> {
  const notion = getNotion(env);
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  return blocksToHtml(blocks.results);
}

function pageToArticle(page: any): Article {
  const props = page.properties;
  return {
    id: page.id,
    title: props.Title?.title?.[0]?.plain_text ?? "",
    slug: props.Slug?.rich_text?.[0]?.plain_text ?? "",
    description: props.Description?.rich_text?.[0]?.plain_text ?? "",
    category: props.Category?.select?.name ?? "",
    tags: props.Tags?.multi_select?.map((t: any) => t.name) ?? [],
    published: props.Published?.checkbox ?? false,
    publishedAt: props.PublishedAt?.date?.start ?? null,
    coverImage: props.CoverImage?.files?.[0]?.file?.url
      ?? props.CoverImage?.files?.[0]?.external?.url
      ?? null,
  };
}

function blocksToHtml(blocks: any[]): string {
  return blocks.map(blockToHtml).filter(Boolean).join("\n");
}

function blockToHtml(block: any): string {
  const type = block.type;
  switch (type) {
    case "paragraph":
      return `<p>${richTextToHtml(block.paragraph.rich_text)}</p>`;
    case "heading_1":
      return `<h1>${richTextToHtml(block.heading_1.rich_text)}</h1>`;
    case "heading_2":
      return `<h2>${richTextToHtml(block.heading_2.rich_text)}</h2>`;
    case "heading_3":
      return `<h3>${richTextToHtml(block.heading_3.rich_text)}</h3>`;
    case "bulleted_list_item":
      return `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>`;
    case "numbered_list_item":
      return `<li>${richTextToHtml(block.numbered_list_item.rich_text)}</li>`;
    case "code":
      return `<pre><code class="language-${block.code.language}">${richTextToHtml(block.code.rich_text)}</code></pre>`;
    case "quote":
      return `<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`;
    case "divider":
      return "<hr />";
    case "image": {
      const url = block.image.file?.url ?? block.image.external?.url ?? "";
      const caption = block.image.caption?.[0]?.plain_text ?? "";
      return `<figure><img src="${url}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    }
    default:
      return "";
  }
}

function richTextToHtml(richText: any[]): string {
  if (!richText?.length) return "";
  return richText.map((rt: any) => {
    let text = rt.plain_text;
    if (rt.annotations.bold) text = `<strong>${text}</strong>`;
    if (rt.annotations.italic) text = `<em>${text}</em>`;
    if (rt.annotations.code) text = `<code>${text}</code>`;
    if (rt.annotations.strikethrough) text = `<s>${text}</s>`;
    if (rt.href) text = `<a href="${rt.href}">${text}</a>`;
    return text;
  }).join("");
}
```

### Step 3: Add KV caching layer

**Create:** `app/lib/cache.server.ts`

```typescript
import type { Env } from "~/types/env";

const DEFAULT_TTL = 300; // 5 minutes

export async function cached<T>(
  env: Env,
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  if (!env.CACHE) return fetcher();

  const cached = await env.CACHE.get(key, "json");
  if (cached) return cached as T;

  const result = await fetcher();
  await env.CACHE.put(key, JSON.stringify(result), { expirationTtl: ttl });
  return result;
}

export async function invalidate(env: Env, key: string): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.delete(key);
}
```

### Step 4: Wire up article list route with loader

**Modify:** `app/routes/articles._index.tsx`

```tsx
import { Link } from "react-router";
import type { Route } from "./+types/articles._index";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const articles = await cached(env, "articles:list", () => getArticles(env));
  return { articles };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Articles — effect.moe" },
    { name: "description", content: "LLMO & DX に関する記事一覧" },
  ];
}

export default function ArticleList({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;

  if (articles.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Articles</h1>
        <p className="text-gray-500">No articles published yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">Articles</h1>
      <div className="space-y-6">
        {articles.map((article) => (
          <article key={article.id} className="border-b border-gray-100 pb-6">
            <Link to={`/articles/${article.slug}`} className="group block">
              {article.category && (
                <span className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  {article.category}
                </span>
              )}
              <h2 className="mt-1 text-xl font-semibold group-hover:text-blue-600">
                {article.title}
              </h2>
              {article.description && (
                <p className="mt-2 text-gray-600">{article.description}</p>
              )}
              {article.publishedAt && (
                <time className="mt-2 block text-sm text-gray-400">
                  {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
                </time>
              )}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
```

### Step 5: Wire up article detail route with loader

**Modify:** `app/routes/articles.$slug.tsx`

```tsx
import { data } from "react-router";
import type { Route } from "./+types/articles.$slug";
import { getArticleBySlug, getArticleContent } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;

  const article = await cached(env, `article:${slug}`, () =>
    getArticleBySlug(env, slug)
  );

  if (!article) {
    throw data(null, { status: 404 });
  }

  const content = await cached(
    env,
    `article-content:${article.id}`,
    () => getArticleContent(env, article.id),
    600,
  );

  return { article, content };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found — effect.moe" }];
  const { article } = loaderData;
  return [
    { title: `${article.title} — effect.moe` },
    { name: "description", content: article.description },
    { property: "og:title", content: article.title },
    { property: "og:description", content: article.description },
    { property: "og:type", content: "article" },
    ...(article.coverImage
      ? [{ property: "og:image", content: article.coverImage }]
      : []),
  ];
}

export default function ArticleDetail({ loaderData }: Route.ComponentProps) {
  const { article, content } = loaderData;

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8">
        {article.category && (
          <span className="text-sm font-medium uppercase tracking-wide text-blue-600">
            {article.category}
          </span>
        )}
        <h1 className="mt-2 text-3xl font-bold">{article.title}</h1>
        {article.publishedAt && (
          <time className="mt-2 block text-sm text-gray-400">
            {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
          </time>
        )}
        {article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>
      <div
        className="prose prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </article>
  );
}
```

### Step 6: Add homepage article preview

**Modify:** `app/routes/_index.tsx`

```tsx
import { Link } from "react-router";
import type { Route } from "./+types/_index";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const articles = await cached(env, "articles:list", () => getArticles(env));
  return { articles: articles.slice(0, 5) };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "effect.moe — LLMO & DX Media" },
    { name: "description", content: "AI時代のWebマーケティングを再定義する LLMO & DX メディア" },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;

  return (
    <div>
      <section className="mb-12">
        <h1 className="mb-4 text-3xl font-bold">effect.moe</h1>
        <p className="text-lg text-gray-600">
          LLMO (Large Language Model Optimization) & DX に特化したメディアサイト。
          AI検索時代のWebマーケティング手法を研究・発信しています。
        </p>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">Latest Articles</h2>
        {articles.length === 0 ? (
          <p className="text-gray-500">No articles published yet.</p>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                to={`/articles/${article.slug}`}
                className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300"
              >
                <h3 className="font-semibold">{article.title}</h3>
                {article.description && (
                  <p className="mt-1 text-sm text-gray-600">{article.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
        {articles.length > 0 && (
          <Link to="/articles" className="mt-4 inline-block text-blue-600 hover:underline">
            View all articles →
          </Link>
        )}
      </section>
    </div>
  );
}
```

### Step 7: Commit

```bash
git add -A
git commit -m "feat: add Notion CMS integration with article list and detail pages"
```

---

## Task 3: AI Crawler Detection Worker

### Step 1: Create AI crawler detection middleware

**Create:** `app/lib/ai-crawler.server.ts`

```typescript
import type { Env } from "~/types/env";

const AI_CRAWLERS: Record<string, string> = {
  "GPTBot": "OpenAI",
  "ChatGPT-User": "OpenAI",
  "OAI-SearchBot": "OpenAI",
  "Claude-Web": "Anthropic",
  "ClaudeBot": "Anthropic",
  "Anthropic": "Anthropic",
  "Google-Extended": "Google",
  "Gemini": "Google",
  "CCBot": "CommonCrawl",
  "PerplexityBot": "Perplexity",
  "Bytespider": "ByteDance",
  "Applebot-Extended": "Apple",
  "Amazonbot": "Amazon",
  "meta-externalagent": "Meta",
  "FacebookBot": "Meta",
  "cohere-ai": "Cohere",
  "YouBot": "You.com",
  "Diffbot": "Diffbot",
  "ImagesiftBot": "Imagesift",
  "Timpibot": "Timpi",
};

export interface CrawlerInfo {
  isAiCrawler: boolean;
  crawlerName: string | null;
  company: string | null;
}

export function detectAiCrawler(userAgent: string): CrawlerInfo {
  if (!userAgent) return { isAiCrawler: false, crawlerName: null, company: null };

  for (const [pattern, company] of Object.entries(AI_CRAWLERS)) {
    if (userAgent.includes(pattern)) {
      return { isAiCrawler: true, crawlerName: pattern, company };
    }
  }

  return { isAiCrawler: false, crawlerName: null, company: null };
}

export async function logCrawlerVisit(
  env: Env,
  crawlerInfo: CrawlerInfo,
  request: Request,
): Promise<void> {
  if (!env.DB || !crawlerInfo.isAiCrawler) return;

  const url = new URL(request.url);

  try {
    await env.DB.prepare(
      `INSERT INTO crawler_logs (crawler_name, company, path, timestamp, user_agent, ip)
       VALUES (?, ?, ?, datetime('now'), ?, ?)`
    )
      .bind(
        crawlerInfo.crawlerName,
        crawlerInfo.company,
        url.pathname,
        request.headers.get("User-Agent") ?? "",
        request.headers.get("CF-Connecting-IP") ?? "",
      )
      .run();
  } catch (e) {
    console.error("Failed to log crawler visit:", e);
  }
}
```

### Step 2: Create D1 schema for crawler logs

**Create:** `migrations/0001_crawler_logs.sql`

```sql
CREATE TABLE IF NOT EXISTS crawler_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawler_name TEXT NOT NULL,
  company TEXT NOT NULL,
  path TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX idx_crawler_logs_timestamp ON crawler_logs(timestamp);
CREATE INDEX idx_crawler_logs_company ON crawler_logs(company);
```

Apply migration after D1 is created:

```bash
wrangler d1 execute effect-site-db --file=migrations/0001_crawler_logs.sql
```

### Step 3: Create middleware to intercept AI crawlers

**Create:** `app/middleware/ai-crawler.ts`

This will be integrated into the server entry. In React Router 7 + Cloudflare, we add this to the request handling.

**Modify:** `app/entry.server.tsx` or use React Router middleware.

For React Router 7, add middleware at the route level. Create a shared middleware:

**Create:** `app/lib/middleware.server.ts`

```typescript
import { detectAiCrawler, logCrawlerVisit } from "~/lib/ai-crawler.server";
import type { Env } from "~/types/env";

export async function aiCrawlerMiddleware(request: Request, env: Env): Promise<Record<string, string>> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  const crawlerInfo = detectAiCrawler(userAgent);

  if (crawlerInfo.isAiCrawler) {
    // Log asynchronously (don't block response)
    logCrawlerVisit(env, crawlerInfo, request);

    return {
      "X-AI-Crawler": crawlerInfo.crawlerName ?? "",
      "X-AI-Context": JSON.stringify({
        site: "effect.moe",
        topic: "LLMO & DX",
        llms_txt: "https://effect.moe/llms.txt",
        structured_data: "JSON-LD on every page",
      }),
    };
  }

  return {};
}
```

### Step 4: Integrate middleware into root loader

**Modify:** `app/root.tsx` — add a root loader that runs the middleware:

```typescript
import { aiCrawlerMiddleware } from "~/lib/middleware.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const extraHeaders = await aiCrawlerMiddleware(request, env);
  return data(
    { aiHeaders: extraHeaders },
    { headers: extraHeaders },
  );
}
```

### Step 5: Create API endpoint for crawler stats

**Create:** `app/routes/api.crawler-stats.ts`

```typescript
import type { Route } from "./+types/api.crawler-stats";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  if (!env.DB) {
    return Response.json({ error: "D1 not configured" }, { status: 503 });
  }

  const stats = await env.DB.prepare(
    `SELECT company, crawler_name, COUNT(*) as visits, MAX(timestamp) as last_visit
     FROM crawler_logs
     GROUP BY company, crawler_name
     ORDER BY visits DESC`
  ).all();

  const recent = await env.DB.prepare(
    `SELECT crawler_name, company, path, timestamp
     FROM crawler_logs
     ORDER BY timestamp DESC
     LIMIT 20`
  ).all();

  return Response.json({ stats: stats.results, recent: recent.results });
}
```

### Step 6: Commit

```bash
git add -A
git commit -m "feat: add AI crawler detection middleware with D1 logging"
```

---

## Task 4: llms.txt and JSON-LD Auto-Generation

### Step 1: Create llms.txt generator

**Create:** `app/lib/llms-txt.server.ts`

```typescript
import type { Env } from "~/types/env";
import type { Article } from "~/lib/notion.server";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function generateLlmsTxt(env: Env): Promise<string> {
  const articles = await cached(env, "articles:list", () => getArticles(env));

  const lines: string[] = [
    "# effect.moe",
    "> LLMO (Large Language Model Optimization) & DX に特化したメディアサイト。AI時代のWebマーケティング手法を研究・発信。",
    "",
    "## Main Pages",
    "- [Home](https://effect.moe/): effect.moe トップページ",
    "- [Articles](https://effect.moe/articles): LLMO & DX に関する記事一覧",
    "- [About](https://effect.moe/about): effect.moe について",
    "",
  ];

  // Group articles by category
  const byCategory = new Map<string, Article[]>();
  for (const article of articles) {
    const cat = article.category || "General";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(article);
  }

  for (const [category, categoryArticles] of byCategory) {
    lines.push(`## ${category}`);
    for (const article of categoryArticles) {
      const desc = article.description ? `: ${article.description}` : "";
      lines.push(
        `- [${article.title}](https://effect.moe/articles/${article.slug})${desc}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
```

### Step 2: Create llms.txt route

**Create:** `app/routes/llms[.]txt.ts`

```typescript
import type { Route } from "./+types/llms[.]txt";
import { generateLlmsTxt } from "~/lib/llms-txt.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const content = await cached(env, "llms-txt", () => generateLlmsTxt(env), 3600);

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

### Step 3: Create JSON-LD generator

**Create:** `app/lib/jsonld.server.ts`

```typescript
import type { Article } from "~/lib/notion.server";

const SITE_URL = "https://effect.moe";
const SITE_NAME = "effect.moe";

export function generateSiteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: "LLMO & DX に特化したメディアサイト",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "ja",
      },
    ],
  };
}

export function generateArticleJsonLd(article: Article): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${SITE_URL}/articles/${article.slug}`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "ja",
        ...(article.coverImage ? { image: article.coverImage } : {}),
        ...(article.tags.length > 0 ? { keywords: article.tags.join(", ") } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Articles",
            item: `${SITE_URL}/articles`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `${SITE_URL}/articles/${article.slug}`,
          },
        ],
      },
    ],
  };
}

export function generateArticleListJsonLd(articles: Article[]): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/articles`,
        name: "Articles — effect.moe",
        description: "LLMO & DX に関する記事一覧",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "ja",
      },
      {
        "@type": "ItemList",
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SITE_URL}/articles/${article.slug}`,
          name: article.title,
        })),
      },
    ],
  };
}
```

### Step 4: Create JsonLd component

**Create:** `app/components/json-ld.tsx`

```tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### Step 5: Add JSON-LD to root layout (site-wide)

**Modify:** `app/root.tsx`

Add in the `<head>` section:

```tsx
import { JsonLd } from "~/components/json-ld";
import { generateSiteJsonLd } from "~/lib/jsonld.server";

// In the Layout component, inside <head>:
<JsonLd data={generateSiteJsonLd()} />
```

### Step 6: Add JSON-LD to article detail page

**Modify:** `app/routes/articles.$slug.tsx`

Add JSON-LD to the component:

```tsx
import { JsonLd } from "~/components/json-ld";
import { generateArticleJsonLd } from "~/lib/jsonld.server";

// At the top of the component return:
export default function ArticleDetail({ loaderData }: Route.ComponentProps) {
  const { article, content } = loaderData;

  return (
    <>
      <JsonLd data={generateArticleJsonLd(article)} />
      <article className="mx-auto max-w-3xl">
        {/* ... existing article markup ... */}
      </article>
    </>
  );
}
```

### Step 7: Add JSON-LD to article list page

**Modify:** `app/routes/articles._index.tsx`

```tsx
import { JsonLd } from "~/components/json-ld";
import { generateArticleListJsonLd } from "~/lib/jsonld.server";

// At the top of the component return:
export default function ArticleList({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;

  return (
    <>
      <JsonLd data={generateArticleListJsonLd(articles)} />
      <div>
        {/* ... existing article list markup ... */}
      </div>
    </>
  );
}
```

### Step 8: Add robots.txt with AI crawler info

**Create:** `app/routes/robots[.]txt.ts`

```typescript
export async function loader() {
  const content = [
    "User-agent: *",
    "Allow: /",
    "",
    "# AI Crawlers Welcome",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: Claude-Web",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Applebot-Extended",
    "Allow: /",
    "",
    "Sitemap: https://effect.moe/sitemap.xml",
    "",
    "# AI-readable site summary",
    "# See: https://effect.moe/llms.txt",
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
```

### Step 9: Add sitemap.xml

**Create:** `app/routes/sitemap[.]xml.ts`

```typescript
import type { Route } from "./+types/sitemap[.]xml";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const articles = await cached(env, "articles:list", () => getArticles(env));

  const staticPages = [
    { loc: "https://effect.moe/", priority: "1.0", changefreq: "daily" },
    { loc: "https://effect.moe/articles", priority: "0.8", changefreq: "daily" },
    { loc: "https://effect.moe/about", priority: "0.5", changefreq: "monthly" },
  ];

  const articlePages = articles.map((a) => ({
    loc: `https://effect.moe/articles/${a.slug}`,
    priority: "0.7",
    changefreq: "weekly",
    lastmod: a.publishedAt ?? undefined,
  }));

  const urls = [...staticPages, ...articlePages];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) =>
        `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

### Step 10: Commit

```bash
git add -A
git commit -m "feat: add llms.txt, JSON-LD, robots.txt, sitemap.xml auto-generation"
```

### Step 11: Full build verification

```bash
cd ~/projects/effect-site
npm run build
```

Expected: Build succeeds with no TypeScript errors.

### Step 12: Deploy and verify

```bash
npm run build && wrangler pages deploy ./build/client
```

Verify:
- `https://effect-site.pages.dev/` — homepage renders
- `https://effect-site.pages.dev/articles` — article list renders
- `https://effect-site.pages.dev/llms.txt` — returns markdown
- `https://effect-site.pages.dev/robots.txt` — returns robots.txt with AI crawler rules
- `https://effect-site.pages.dev/sitemap.xml` — returns valid XML

### Step 13: Final commit

```bash
git add -A
git commit -m "chore: Phase 1 frontend tasks 1-4 complete"
git push origin main
```

---

## Cloudflare Resource Setup Checklist

Before Task 2-4 loaders work in production, create these in Cloudflare Dashboard:

1. **D1 Database:** `effect-site-db` → copy ID to wrangler.toml
2. **KV Namespace:** `effect-cache` → copy ID to wrangler.toml
3. **Secrets:** `wrangler secret put NOTION_API_KEY` (use the Notion API token from your .env or password manager)
4. **Run migration:** `wrangler d1 execute effect-site-db --file=migrations/0001_crawler_logs.sql`

## Notion Database Setup Checklist

1. Create article database with properties defined in Task 2, Step 1
2. Share database with "Claude MCP" integration
3. Copy database ID to wrangler.toml `NOTION_DATABASE_ARTICLES`
4. Create 1-2 test articles to verify CMS integration
