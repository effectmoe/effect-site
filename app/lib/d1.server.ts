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

export interface PanelData {
  id: string;
  panel_order: number;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  transcript: string | null;
  ai_context: string | null;
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
           transcript, ai_context
    FROM panels
    WHERE article_id = ?
    ORDER BY panel_order ASC
  `,
    )
    .bind(row.id)
    .all<PanelData>();

  return {
    article: parseArticle(row),
    panels: panels.results,
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
      audioAnchors = JSON.parse(row.audio_anchors) as AudioAnchor[];
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
