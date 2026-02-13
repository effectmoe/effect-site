import { cached } from "~/lib/cache.server";

interface LlmsArticleRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  global_llm_text: string | null;
  panel_count: number;
  cluster_id: string | null;
  cluster_name: string | null;
  cluster_slug: string | null;
  order_in_cluster: number;
}

interface LlmsPanelRow {
  article_id: string;
  panel_order: number;
  transcript: string | null;
  ai_context: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateLlmsTxt(env: any): Promise<string> {
  const siteUrl: string = env.SITE_URL;
  const db: D1Database = env.DB;

  // Fetch all published articles with cluster info
  const articles = await cached(env.CACHE, "llms:articles", async () => {
    const rows = await db
      .prepare(
        `
      SELECT a.id, a.title, a.slug, a.description, a.category,
             a.global_llm_text, a.panel_count, a.cluster_id,
             a.order_in_cluster,
             c.name as cluster_name, c.slug as cluster_slug
      FROM articles a
      LEFT JOIN clusters c ON a.cluster_id = c.id
      WHERE a.published = 1
      ORDER BY c.sort_order ASC, a.order_in_cluster ASC, a.published_at DESC
    `,
      )
      .all<LlmsArticleRow>();
    return rows.results;
  });

  // Fetch transcripts for all articles that have panels
  const articleIds = articles
    .filter((a) => a.panel_count > 0)
    .map((a) => a.id);

  let panelsByArticle = new Map<string, LlmsPanelRow[]>();
  if (articleIds.length > 0) {
    panelsByArticle = await cached(
      env.CACHE,
      "llms:panels",
      async () => {
        const rows = await db
          .prepare(
            `
        SELECT article_id, panel_order, transcript, ai_context
        FROM panels
        ORDER BY article_id, panel_order ASC
      `,
          )
          .all<LlmsPanelRow>();

        const map = new Map<string, LlmsPanelRow[]>();
        for (const row of rows.results) {
          if (!map.has(row.article_id)) map.set(row.article_id, []);
          map.get(row.article_id)!.push(row);
        }
        return map;
      },
    );
  }

  const lines: string[] = [
    "# effect.moe",
    "> LLMO (Large Language Model Optimization) & DX media site. Researching and publishing web marketing methods for the AI era.",
    "",
    "## Main Pages",
    `- [Home](${siteUrl}/): effect.moe top page`,
    `- [Articles](${siteUrl}/articles): LLMO & DX article list`,
    `- [About](${siteUrl}/about): About effect.moe`,
    "",
  ];

  // Group by cluster first, then unclustered articles
  const clustered = new Map<
    string,
    { name: string; slug: string; articles: LlmsArticleRow[] }
  >();
  const unclustered: LlmsArticleRow[] = [];

  for (const article of articles) {
    if (article.cluster_id && article.cluster_name) {
      if (!clustered.has(article.cluster_id)) {
        clustered.set(article.cluster_id, {
          name: article.cluster_name,
          slug: article.cluster_slug ?? article.cluster_id,
          articles: [],
        });
      }
      clustered.get(article.cluster_id)!.articles.push(article);
    } else {
      unclustered.push(article);
    }
  }

  // Emit clustered articles as series
  for (const [, cluster] of clustered) {
    lines.push(`## Series: ${cluster.name}`);
    lines.push("");
    for (const article of cluster.articles) {
      appendArticle(lines, article, panelsByArticle, siteUrl);
    }
  }

  // Emit unclustered articles grouped by category
  const byCategory = new Map<string, LlmsArticleRow[]>();
  for (const article of unclustered) {
    const cat = article.category || "General";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(article);
  }

  for (const [category, categoryArticles] of byCategory) {
    lines.push(`## ${category}`);
    lines.push("");
    for (const article of categoryArticles) {
      appendArticle(lines, article, panelsByArticle, siteUrl);
    }
  }

  return lines.join("\n");
}

function appendArticle(
  lines: string[],
  article: LlmsArticleRow,
  panelsByArticle: Map<string, LlmsPanelRow[]>,
  siteUrl: string,
): void {
  const desc = article.description ? `: ${article.description}` : "";
  const manga =
    article.panel_count > 0 ? ` (manga, ${article.panel_count} panels)` : "";
  lines.push(
    `### [${article.title}](${siteUrl}/articles/${article.slug})${manga}`,
  );
  if (desc) {
    lines.push(desc.slice(2)); // remove leading ": "
  }

  // Global LLM text (expert content)
  if (article.global_llm_text) {
    lines.push("");
    lines.push(article.global_llm_text);
  }

  // Panel transcripts
  const panels = panelsByArticle.get(article.id);
  if (panels && panels.length > 0) {
    const transcripts = panels
      .filter((p) => p.transcript)
      .map((p) => `Panel ${p.panel_order}: ${p.transcript}`);

    if (transcripts.length > 0) {
      lines.push("");
      lines.push("Transcript:");
      for (const t of transcripts) {
        lines.push(`  ${t}`);
      }
    }
  }

  lines.push("");
}
