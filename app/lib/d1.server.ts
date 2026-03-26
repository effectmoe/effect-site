/**
 * D1 query layer for clusters, articles, and panels.
 * Primary read DB for the 3-Layer Manga UX.
 */

// --- Type Definitions ---

export interface AudioAnchor {
  panel: number;
  start: number; // seconds
  end: number; // seconds
}

export interface PanelFaq {
  id: number;
  question: string;
  answer: string;
}

export interface PanelGlossary {
  id: number;
  term: string;
  reading: string | null;
  description: string;
  category: string; // 'primary' | 'related'
}

export interface PanelData {
  id: string;
  panel_order: number;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  transcript: string | null;
  ai_context: string | null;
  synced_at: string | null;
  faqs: PanelFaq[];
  glossary: PanelGlossary[];
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  order_in_cluster: number;
  panel_count: number;
  cluster_name: string | null;
}

export interface ArticleFull extends ArticleSummary {
  global_llm_text: string | null;
  audio_url: string | null;
  audio_anchors: AudioAnchor[] | null;
  infographic_url: string | null;
  tags: string[];
  published_at: string | null;
  cluster_id: string | null;
  cluster_slug: string | null;
}

export interface ClusterWithArticles {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  articles: ArticleSummary[];
}

// --- Row types from D1 ---

interface ClusterArticleRow {
  cid: string;
  name: string;
  cslug: string;
  description: string | null;
  status: string;
  sort_order: number;
  aid: string | null;
  title: string | null;
  aslug: string | null;
  adesc: string | null;
  category: string | null;
  cover_image_url: string | null;
  order_in_cluster: number | null;
  panel_count: number | null;
}

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string | null;
  published: number;
  published_at: string | null;
  cover_image_url: string | null;
  cluster_id: string | null;
  order_in_cluster: number;
  global_llm_text: string | null;
  audio_url: string | null;
  audio_anchors: string | null;
  infographic_url: string | null;
  panel_count: number;
  reading_time_seconds: number;
  cluster_name?: string | null;
  cluster_slug?: string | null;
}

// --- Queries ---

/**
 * Q1: Grid (/) - All active clusters with their published articles.
 * Returns clusters ordered by sort_order, articles ordered by order_in_cluster.
 */
export async function getClustersWithArticles(
  db: D1Database,
): Promise<ClusterWithArticles[]> {
  const rows = await db
    .prepare(
      `
    SELECT
      c.id as cid, c.name, c.slug as cslug,
      c.description, c.status, c.sort_order,
      a.id as aid, a.title, a.slug as aslug,
      a.description as adesc, a.category,
      a.cover_image_url, a.order_in_cluster,
      a.panel_count
    FROM clusters c
    LEFT JOIN articles a
      ON a.cluster_id = c.id AND a.published = 1
    WHERE c.status IN ('active', 'complete')
    ORDER BY c.sort_order ASC,
             a.order_in_cluster ASC
  `,
    )
    .all<ClusterArticleRow>();

  return groupByCluster(rows.results);
}

/**
 * Q2: Article detail with all panels.
 * Used by timeline and manga reader routes.
 */
export async function getArticleWithPanels(
  db: D1Database,
  slug: string,
): Promise<{ article: ArticleFull; panels: PanelData[] } | null> {
  const row = await db
    .prepare(
      `
    SELECT a.*,
           c.name as cluster_name,
           c.slug as cluster_slug
    FROM articles a
    LEFT JOIN clusters c ON a.cluster_id = c.id
    WHERE a.slug = ? AND a.published = 1
  `,
    )
    .bind(slug)
    .first<ArticleRow>();

  if (!row) return null;

  const panels = await db
    .prepare(
      `
    SELECT id, panel_order, image_url, image_width, image_height,
           transcript, ai_context, synced_at
    FROM panels
    WHERE article_id = ?
    ORDER BY panel_order ASC
  `,
    )
    .bind(row.id)
    .all<Omit<PanelData, "faqs" | "glossary">>();

  const faqRows = await db
    .prepare(
      `
    SELECT panel_id, id, question, answer
    FROM panel_faqs
    WHERE article_slug = ?
    ORDER BY panel_order ASC, id ASC
  `,
    )
    .bind(slug)
    .all<{ panel_id: string; id: number; question: string; answer: string }>();

  // Glossary query is non-fatal: if table is missing or query fails, return empty
  let glossaryRows: D1Result<{ panel_id: string; id: number; term: string; reading: string | null; description: string; category: string }>;
  try {
    glossaryRows = await db
      .prepare(
        `
    SELECT panel_id, id, term, reading, description, category
    FROM panel_glossary
    WHERE article_slug = ?
    ORDER BY panel_order ASC, category ASC, id ASC
  `,
      )
      .bind(slug)
      .all<{ panel_id: string; id: number; term: string; reading: string | null; description: string; category: string }>();
  } catch {
    glossaryRows = { results: [], success: true, meta: {} as D1Result<unknown>["meta"] };
  }

  const faqMap = new Map<string, PanelFaq[]>();
  for (const f of faqRows.results) {
    if (!faqMap.has(f.panel_id)) faqMap.set(f.panel_id, []);
    faqMap.get(f.panel_id)!.push({ id: f.id, question: f.question, answer: f.answer });
  }

  const glossaryMap = new Map<string, PanelGlossary[]>();
  for (const g of glossaryRows.results) {
    if (!glossaryMap.has(g.panel_id)) glossaryMap.set(g.panel_id, []);
    glossaryMap.get(g.panel_id)!.push({
      id: g.id,
      term: g.term,
      reading: g.reading,
      description: g.description,
      category: g.category,
    });
  }

  const panelsWithFaqs: PanelData[] = panels.results.map((p) => ({
    ...p,
    faqs: faqMap.get(p.id) ?? [],
    glossary: glossaryMap.get(p.id) ?? [],
  }));

  return {
    article: parseArticle(row),
    panels: panelsWithFaqs,
  };
}

/**
 * Q3: Adjacent articles in the same cluster for prev/next navigation.
 */
export async function getAdjacentArticles(
  db: D1Database,
  clusterId: string,
  currentOrder: number,
): Promise<{ prev: ArticleSummary | null; next: ArticleSummary | null }> {
  const [prevRow, nextRow] = await Promise.all([
    db
      .prepare(
        `
      SELECT id, title, slug, description, category,
             cover_image_url, order_in_cluster, panel_count
      FROM articles
      WHERE cluster_id = ?
        AND order_in_cluster < ?
        AND published = 1
      ORDER BY order_in_cluster DESC
      LIMIT 1
    `,
      )
      .bind(clusterId, currentOrder)
      .first<ArticleRow>(),
    db
      .prepare(
        `
      SELECT id, title, slug, description, category,
             cover_image_url, order_in_cluster, panel_count
      FROM articles
      WHERE cluster_id = ?
        AND order_in_cluster > ?
        AND published = 1
      ORDER BY order_in_cluster ASC
      LIMIT 1
    `,
      )
      .bind(clusterId, currentOrder)
      .first<ArticleRow>(),
  ]);

  return {
    prev: prevRow ? parseArticleSummary(prevRow) : null,
    next: nextRow ? parseArticleSummary(nextRow) : null,
  };
}

/**
 * Q4: All published articles in a cluster for timeline view.
 */
export async function getClusterArticles(
  db: D1Database,
  clusterId: string,
): Promise<ArticleSummary[]> {
  const rows = await db
    .prepare(
      `
    SELECT a.id, a.title, a.slug, a.description, a.category,
           a.cover_image_url, a.order_in_cluster, a.panel_count,
           c.name as cluster_name
    FROM articles a
    LEFT JOIN clusters c ON a.cluster_id = c.id
    WHERE a.cluster_id = ? AND a.published = 1
    ORDER BY a.order_in_cluster ASC
  `,
    )
    .bind(clusterId)
    .all<ArticleRow & { cluster_name: string | null }>();

  return rows.results.map((r) => parseArticleSummary(r));
}

/**
 * Q4b: Articles not belonging to any cluster (standalone).
 */
export async function getStandaloneArticles(
  db: D1Database,
): Promise<ArticleSummary[]> {
  const rows = await db
    .prepare(
      `
    SELECT id, title, slug, description, category,
           cover_image_url, order_in_cluster, panel_count,
           NULL as cluster_name
    FROM articles
    WHERE cluster_id IS NULL AND published = 1
    ORDER BY published_at DESC
  `,
    )
    .all<ArticleRow & { cluster_name: string | null }>();

  return rows.results.map((r) => parseArticleSummary(r));
}

/**
 * Q5: Single cluster by slug for cluster hub page.
 */
export async function getClusterBySlug(
  db: D1Database,
  slug: string,
): Promise<ClusterWithArticles | null> {
  const cluster = await db
    .prepare(
      `
    SELECT id, name, slug, description, status
    FROM clusters
    WHERE slug = ? AND status IN ('active', 'complete')
  `,
    )
    .bind(slug)
    .first<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      status: string;
    }>();

  if (!cluster) return null;

  const articles = await getClusterArticles(db, cluster.id);

  return {
    ...cluster,
    articles,
  };
}

// --- Glossary Queries ---

export interface GlossaryEntry {
  term: string;
  reading: string | null;
  description: string;
  category: string;
  article_slug: string;
  article_title: string;
}

/**
 * Q6: All unique glossary terms with article info for /glossary page.
 */
export async function getGlossaryTerms(
  db: D1Database,
): Promise<GlossaryEntry[]> {
  const rows = await db
    .prepare(
      `
    SELECT pg.term, pg.reading, pg.description, pg.category,
           pg.article_slug, a.title as article_title
    FROM panel_glossary pg
    JOIN articles a ON pg.article_slug = a.slug AND a.published = 1
    GROUP BY pg.term
    ORDER BY pg.reading ASC, pg.term ASC
  `,
    )
    .all<GlossaryEntry>();
  return rows.results;
}

/**
 * Q7: Distinct term list for auto-linking (longest first to avoid partial matches).
 */
export async function getGlossaryTermList(
  db: D1Database,
): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT term FROM panel_glossary ORDER BY length(term) DESC`,
    )
    .all<{ term: string }>();
  return rows.results.map((r) => r.term);
}

// --- Knowledge Base Queries ---

export interface KnowledgeFaq {
  question: string;
  answer: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  content_html: string;
  published_at: string | null;
  cover_image_url: string | null;
  related_manga_slugs: string[];
  related_glossary_terms: string[];
  reading_time_minutes: number;
  faqs: KnowledgeFaq[];
}

export interface KnowledgeArticleSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
  cover_image_url: string | null;
  reading_time_minutes: number;
}

interface KnowledgeRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string | null;
  content_html: string;
  published: number;
  published_at: string | null;
  cover_image_url: string | null;
  related_manga_slugs: string | null;
  related_glossary_terms: string | null;
  reading_time_minutes: number;
  faqs: string | null;
}

/**
 * Q8: All published knowledge articles for /knowledge index.
 */
export async function getKnowledgeArticles(
  db: D1Database,
): Promise<KnowledgeArticleSummary[]> {
  const rows = await db
    .prepare(
      `
    SELECT id, title, slug, description, category, tags,
           published_at, cover_image_url, reading_time_minutes
    FROM knowledge_articles
    WHERE published = 1
    ORDER BY published_at DESC
  `,
    )
    .all<KnowledgeRow>();

  return rows.results.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    category: r.category,
    tags: parseJsonArray(r.tags),
    published_at: r.published_at,
    cover_image_url: r.cover_image_url,
    reading_time_minutes: r.reading_time_minutes,
  }));
}

/**
 * Q9: Single knowledge article by slug.
 */
export async function getKnowledgeArticle(
  db: D1Database,
  slug: string,
): Promise<KnowledgeArticle | null> {
  const row = await db
    .prepare(
      `
    SELECT * FROM knowledge_articles
    WHERE slug = ? AND published = 1
  `,
    )
    .bind(slug)
    .first<KnowledgeRow>();

  if (!row) return null;

  let faqs: KnowledgeFaq[] = [];
  if (row.faqs) {
    try {
      faqs = JSON.parse(row.faqs);
    } catch { /* ignore malformed */ }
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    tags: parseJsonArray(row.tags),
    content_html: row.content_html,
    published_at: row.published_at,
    cover_image_url: row.cover_image_url,
    related_manga_slugs: parseJsonArray(row.related_manga_slugs),
    related_glossary_terms: parseJsonArray(row.related_glossary_terms),
    reading_time_minutes: row.reading_time_minutes,
    faqs,
  };
}

/**
 * Q10: Knowledge articles related to a manga article (for triple-link).
 */
export async function getRelatedKnowledge(
  db: D1Database,
  mangaSlug: string,
): Promise<KnowledgeArticleSummary[]> {
  const rows = await db
    .prepare(
      `
    SELECT id, title, slug, description, category, tags,
           published_at, cover_image_url, reading_time_minutes
    FROM knowledge_articles
    WHERE published = 1
      AND related_manga_slugs LIKE ?
    ORDER BY published_at DESC
  `,
    )
    .bind(`%"${mangaSlug}"%`)
    .all<KnowledgeRow>();

  return rows.results.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    category: r.category,
    tags: parseJsonArray(r.tags),
    published_at: r.published_at,
    cover_image_url: r.cover_image_url,
    reading_time_minutes: r.reading_time_minutes,
  }));
}

function parseJsonArray(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

// --- Helpers ---

function groupByCluster(rows: ClusterArticleRow[]): ClusterWithArticles[] {
  const map = new Map<string, ClusterWithArticles>();

  for (const row of rows) {
    if (!map.has(row.cid)) {
      map.set(row.cid, {
        id: row.cid,
        name: row.name,
        slug: row.cslug,
        description: row.description,
        status: row.status,
        articles: [],
      });
    }

    // LEFT JOIN may produce null article columns
    if (row.aid && row.title && row.aslug) {
      map.get(row.cid)!.articles.push({
        id: row.aid,
        title: row.title,
        slug: row.aslug,
        description: row.adesc ?? null,
        category: row.category ?? null,
        cover_image_url: row.cover_image_url ?? null,
        order_in_cluster: row.order_in_cluster ?? 0,
        panel_count: row.panel_count ?? 0,
        cluster_name: row.name,
      });
    }
  }

  return Array.from(map.values());
}

function parseArticle(row: ArticleRow): ArticleFull {
  let audioAnchors: AudioAnchor[] | null = null;
  if (row.audio_anchors) {
    try {
      const raw = JSON.parse(row.audio_anchors) as Array<Record<string, unknown>>;
      // Normalize different anchor formats:
      //   DB may store {panel, start_sec} or {panel, start, end} or {panelIndex, startTime, endTime}
      const sorted = raw
        .map((a) => ({
          panel: (a.panel ?? a.panelIndex ?? 0) as number,
          start: (a.start ?? a.startTime ?? a.start_sec ?? 0) as number,
          end: (a.end ?? a.endTime ?? null) as number | null,
        }))
        .sort((x, y) => x.start - y.start);
      // Fill in missing 'end' values from next anchor's start
      audioAnchors = sorted.map((a, i) => ({
        panel: a.panel,
        start: a.start,
        end: a.end ?? (i < sorted.length - 1 ? sorted[i + 1].start : a.start + 600),
      }));
    } catch {
      audioAnchors = null;
    }
  }

  let tags: string[] = [];
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags) as string[];
    } catch {
      tags = [];
    }
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    cover_image_url: row.cover_image_url,
    order_in_cluster: row.order_in_cluster,
    panel_count: row.panel_count,
    cluster_name: row.cluster_name ?? null,
    global_llm_text: row.global_llm_text,
    audio_url: row.audio_url,
    audio_anchors: audioAnchors,
    infographic_url: row.infographic_url ?? null,
    tags,
    published_at: row.published_at,
    cluster_id: row.cluster_id,
    cluster_slug: row.cluster_slug ?? null,
  };
}

function parseArticleSummary(
  row: ArticleRow & { cluster_name?: string | null },
): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    cover_image_url: row.cover_image_url,
    order_in_cluster: row.order_in_cluster,
    panel_count: row.panel_count,
    cluster_name: row.cluster_name ?? null,
  };
}
