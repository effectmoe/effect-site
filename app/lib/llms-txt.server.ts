import type { Article } from "~/lib/notion.server";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateLlmsTxt(env: any): Promise<string> {
  const siteUrl: string = env.SITE_URL;
  const articles = await cached(env.CACHE, "articles:list", () =>
    getArticles(env),
  );

  const lines: string[] = [
    "# effect.moe",
    "> LLMO (Large Language Model Optimization) & DX に特化したメディアサイト。AI時代のWebマーケティング手法を研究・発信。",
    "",
    "## Main Pages",
    `- [Home](${siteUrl}/): effect.moe top page`,
    `- [Articles](${siteUrl}/articles): LLMO & DX article list`,
    `- [About](${siteUrl}/about): About effect.moe`,
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
        `- [${article.title}](${siteUrl}/articles/${article.slug})${desc}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
