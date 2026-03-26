import type { Route } from "./+types/sitemap[.]xml";
import { cached } from "~/lib/cache.server";

interface SitemapArticle {
  slug: string;
  published_at: string | null;
  panel_count: number;
}

interface SitemapKnowledge {
  slug: string;
  published_at: string | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const siteUrl = env.SITE_URL;

  // Use D1 directly to get panel_count for reader page URLs
  const articles = await cached(env.CACHE, "sitemap:articles", async () => {
    const rows = await env.DB.prepare(
      "SELECT slug, published_at, panel_count FROM articles WHERE published = 1 ORDER BY published_at DESC",
    ).all<SitemapArticle>();
    return rows.results;
  });

  const staticPages = [
    { loc: `${siteUrl}/`, priority: "1.0", changefreq: "daily" },
    {
      loc: `${siteUrl}/articles`,
      priority: "0.8",
      changefreq: "daily",
    },
    {
      loc: `${siteUrl}/about`,
      priority: "0.5",
      changefreq: "monthly",
    },
    {
      loc: `${siteUrl}/representative`,
      priority: "0.6",
      changefreq: "monthly",
    },
    {
      loc: `${siteUrl}/knowledge`,
      priority: "0.7",
      changefreq: "weekly",
    },
    {
      loc: `${siteUrl}/glossary`,
      priority: "0.6",
      changefreq: "weekly",
    },
  ];

  const knowledgeArticles = await cached(env.CACHE, "sitemap:knowledge", async () => {
    const rows = await env.DB.prepare(
      "SELECT slug, published_at FROM knowledge_articles WHERE published = 1 ORDER BY published_at DESC",
    ).all<SitemapKnowledge>();
    return rows.results;
  });

  const knowledgePages = knowledgeArticles.map((k) => ({
    loc: `${siteUrl}/knowledge/${k.slug}`,
    priority: "0.7",
    changefreq: "weekly" as const,
    lastmod: k.published_at ?? undefined,
  }));

  const articlePages = articles.map((a) => ({
    loc: `${siteUrl}/articles/${a.slug}`,
    priority: "0.7",
    changefreq: "weekly" as const,
    lastmod: a.published_at ?? undefined,
  }));

  // Add individual manga reader pages to sitemap
  const readerPages = articles.flatMap((a) =>
    a.panel_count > 0
      ? Array.from({ length: a.panel_count }, (_, i) => ({
          loc: `${siteUrl}/articles/${a.slug}/p/${i + 1}`,
          priority: "0.6",
          changefreq: "monthly" as const,
          lastmod: a.published_at ?? undefined,
        }))
      : [],
  );

  const urls = [...staticPages, ...knowledgePages, ...articlePages, ...readerPages];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n    <changefreq>${u.changefreq}</changefreq>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`,
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
