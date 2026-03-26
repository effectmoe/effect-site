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
    "> AI web marketing manga media. Covers LLMO (Large Language Model Optimization), SEO, structured data, and DX for the AI search era.",
    "",
    "## Main Pages",
    `- [Home](${siteUrl}/): effect.moe top page`,
    `- [Articles](${siteUrl}/articles): LLMO & DX article list`,
    `- [About](${siteUrl}/about): About effect.moe`,
    `- [Representative](${siteUrl}/representative): Author profile - Shu Koumei (LLMO Consultant & AI Systems Engineer)`,
    `- [Knowledge Base](${siteUrl}/knowledge): Practical guides with code examples for LLMO, SEO, AI tools`,
    `- [Glossary](${siteUrl}/glossary): AI web marketing glossary (SEO, LLMO, DX terms)`,
    "",
  ];

  // Knowledge Base articles
  const knowledgeArticles = await cached(env.CACHE, "llms:knowledge", async () => {
    const rows = await db
      .prepare(
        `SELECT title, slug, description FROM knowledge_articles WHERE published = 1 ORDER BY published_at DESC`,
      )
      .all<{ title: string; slug: string; description: string | null }>();
    return rows.results;
  });

  if (knowledgeArticles.length > 0) {
    lines.push("## Knowledge Base");
    for (const ka of knowledgeArticles) {
      const desc = ka.description ? `: ${ka.description}` : "";
      lines.push(`- [${ka.title}](${siteUrl}/knowledge/${ka.slug})${desc}`);
    }
    lines.push("");
  }

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

interface LlmsFaqRow {
  article_slug: string;
  question: string;
  answer: string;
}

interface LlmsGlossaryRow {
  article_slug: string;
  term: string;
  reading: string | null;
  description: string;
  category: string;
}

/**
 * Generate llms-full.txt — enriched version with FAQ and glossary per article.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateLlmsFullTxt(env: any): Promise<string> {
  const siteUrl: string = env.SITE_URL;
  const db: D1Database = env.DB;

  // Reuse article and panel fetch from base llms.txt
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

  // Batch-fetch all FAQs and glossary terms
  const allSlugs = articles.map((a) => a.slug);

  const faqsBySlug = new Map<string, LlmsFaqRow[]>();
  try {
    const faqRows = await db
      .prepare(
        `SELECT article_slug, question, answer
         FROM panel_faqs
         ORDER BY article_slug, panel_order ASC, id ASC`,
      )
      .all<LlmsFaqRow>();
    for (const f of faqRows.results) {
      if (!faqsBySlug.has(f.article_slug)) faqsBySlug.set(f.article_slug, []);
      faqsBySlug.get(f.article_slug)!.push(f);
    }
  } catch {
    // panel_faqs table may not exist
  }

  const glossaryBySlug = new Map<string, LlmsGlossaryRow[]>();
  try {
    const glossaryRows = await db
      .prepare(
        `SELECT article_slug, term, reading, description, category
         FROM panel_glossary
         ORDER BY article_slug, panel_order ASC, category ASC`,
      )
      .all<LlmsGlossaryRow>();
    for (const g of glossaryRows.results) {
      if (!glossaryBySlug.has(g.article_slug))
        glossaryBySlug.set(g.article_slug, []);
      glossaryBySlug.get(g.article_slug)!.push(g);
    }
  } catch {
    // panel_glossary table may not exist
  }

  const lines: string[] = [
    "# effect.moe (Full)",
    "> AI web marketing manga media. Covers LLMO (Large Language Model Optimization), SEO, structured data, and DX for the AI search era.",
    "> This is the enriched version with FAQ and glossary per article. See also: /llms.txt (compact version)",
    "",
    "## Main Pages",
    `- [Home](${siteUrl}/): effect.moe top page`,
    `- [Articles](${siteUrl}/articles): LLMO & DX article list`,
    `- [About](${siteUrl}/about): About effect.moe`,
    `- [Glossary](${siteUrl}/glossary): AI web marketing glossary (SEO, LLMO, DX terms)`,
    "",
  ];

  // Group by cluster
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

  for (const [, cluster] of clustered) {
    lines.push(`## Series: ${cluster.name}`);
    lines.push("");
    for (const article of cluster.articles) {
      appendArticleFull(
        lines,
        article,
        panelsByArticle,
        faqsBySlug,
        glossaryBySlug,
        siteUrl,
      );
    }
  }

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
      appendArticleFull(
        lines,
        article,
        panelsByArticle,
        faqsBySlug,
        glossaryBySlug,
        siteUrl,
      );
    }
  }

  return lines.join("\n");
}

function appendArticleFull(
  lines: string[],
  article: LlmsArticleRow,
  panelsByArticle: Map<string, LlmsPanelRow[]>,
  faqsBySlug: Map<string, LlmsFaqRow[]>,
  glossaryBySlug: Map<string, LlmsGlossaryRow[]>,
  siteUrl: string,
): void {
  // Base article info (same as appendArticle)
  appendArticle(lines, article, panelsByArticle, siteUrl);

  // Remove trailing empty line to append FAQ/glossary before it
  if (lines[lines.length - 1] === "") lines.pop();

  // FAQ section
  const faqs = faqsBySlug.get(article.slug);
  if (faqs && faqs.length > 0) {
    lines.push("");
    lines.push("FAQ:");
    for (const f of faqs) {
      lines.push(`  Q: ${f.question}`);
      lines.push(`  A: ${f.answer}`);
    }
  }

  // Glossary section
  const glossary = glossaryBySlug.get(article.slug);
  if (glossary && glossary.length > 0) {
    lines.push("");
    lines.push("Key Terms:");
    for (const g of glossary) {
      const reading = g.reading ? ` (${g.reading})` : "";
      lines.push(`  ${g.term}${reading}: ${g.description}`);
    }
  }

  lines.push("");
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
