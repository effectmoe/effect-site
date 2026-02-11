import type { Route } from "./+types/sitemap[.]xml";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const articles = await cached(env.CACHE, "articles:list", () =>
    getArticles(env),
  );

  const staticPages = [
    { loc: "https://effect.moe/", priority: "1.0", changefreq: "daily" },
    {
      loc: "https://effect.moe/articles",
      priority: "0.8",
      changefreq: "daily",
    },
    {
      loc: "https://effect.moe/about",
      priority: "0.5",
      changefreq: "monthly",
    },
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
