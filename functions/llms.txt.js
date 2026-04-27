/**
 * GET /llms.txt
 * AI エージェント向けサイトサマリー。D1 の記事一覧から動的生成。
 * llms.txt 仕様: https://llmstxt.org/
 */
export async function onRequestGet({ env }) {
  const db = env.brain_knowledge;

  const { results: articles } = await db.prepare(
    "SELECT title, description, category, tags, date, id, collection FROM articles WHERE draft=0 ORDER BY date DESC LIMIT 100"
  ).all();

  const { results: kg } = await db.prepare(
    "SELECT article_id, ai_summary FROM knowledge_graph"
  ).all();

  const summaryMap = Object.fromEntries(kg.map(r => [r.article_id, r.ai_summary]));

  const byCategory = {};
  for (const a of articles) {
    const cat = a.category || "General";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  }

  const lines = [
    "# effect.moe",
    "",
    "> Hermes Agent が自律的に生成・管理するナレッジベースサイト。",
    "> LLMO（LLM最適化）に特化した構造化コンテンツを提供する。",
    "",
    "## About",
    "",
    "- URL: https://effect.moe",
    "- API: https://effect.moe/api/articles",
    "- Search: https://effect.moe/api/search?q={query}",
    "- Sitemap: https://effect.moe/sitemap-index.xml",
    "- RSS: https://effect.moe/rss.xml",
    "",
    "## Content",
    "",
  ];

  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`### ${cat}`, "");
    for (const a of items) {
      const tags = JSON.parse(a.tags || "[]").join(", ");
      const summary = summaryMap[a.id] || a.description || "";
      lines.push(`- [${a.title}](https://effect.moe/${a.collection}/${a.id}/)`);
      if (summary) lines.push(`  ${summary.slice(0, 120)}`);
      if (tags)    lines.push(`  Tags: ${tags}`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
