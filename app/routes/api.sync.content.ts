/**
 * POST /api/sync/content
 * Upserts clusters, articles, and panels metadata into D1.
 * Invalidates affected KV cache keys.
 * Called by n8n sync workflow after media upload.
 *
 * Body: { clusters?: [...], articles?: [...], panels?: [...] }
 */
import type { Route } from "./+types/api.sync.content";
import { authenticateRequest } from "~/lib/auth.server";

// --- Sync payload types ---

interface SyncCluster {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pillar_article_id: string | null;
  status: string;
  sort_order: number;
  notion_last_edited: string | null;
}

interface SyncArticle {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string | null; // JSON string
  published: number;
  published_at: string | null;
  cover_image_url: string | null;
  cluster_id: string | null;
  order_in_cluster: number;
  global_llm_text: string | null;
  audio_url: string | null;
  audio_anchors: string | null; // JSON string
  panel_count: number;
  reading_time_seconds: number;
  notion_last_edited: string | null;
}

interface SyncPanel {
  id: string;
  article_id: string;
  panel_order: number;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  transcript: string | null;
  ai_context: string | null;
  notion_last_edited: string | null;
}

interface SyncBody {
  clusters?: SyncCluster[];
  articles?: SyncArticle[];
  panels?: SyncPanel[];
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;

  // Auth check
  const authError = authenticateRequest(request, env.ADMIN_API_KEY);
  if (authError) return authError;

  if (!env.DB) {
    return Response.json(
      { error: "DB binding not available" },
      { status: 503 },
    );
  }

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const results = { clusters: 0, articles: 0, panels: 0 };
  const errors: string[] = [];

  // Upsert clusters
  if (body.clusters?.length) {
    for (const c of body.clusters) {
      try {
        await env.DB.prepare(
          `
          INSERT OR REPLACE INTO clusters
          (id, name, slug, description, pillar_article_id,
           status, sort_order, notion_last_edited, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
        )
          .bind(
            c.id,
            c.name,
            c.slug,
            c.description,
            c.pillar_article_id,
            c.status,
            c.sort_order,
            c.notion_last_edited,
          )
          .run();
        results.clusters++;
      } catch (e) {
        errors.push(
          `cluster ${c.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // Upsert articles
  if (body.articles?.length) {
    for (const a of body.articles) {
      try {
        await env.DB.prepare(
          `
          INSERT OR REPLACE INTO articles
          (id, title, slug, description, category, tags,
           published, published_at, cover_image_url,
           cluster_id, order_in_cluster, global_llm_text,
           audio_url, audio_anchors, panel_count,
           reading_time_seconds, notion_last_edited, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
        )
          .bind(
            a.id,
            a.title,
            a.slug,
            a.description,
            a.category,
            a.tags,
            a.published,
            a.published_at,
            a.cover_image_url,
            a.cluster_id,
            a.order_in_cluster,
            a.global_llm_text,
            a.audio_url,
            a.audio_anchors,
            a.panel_count,
            a.reading_time_seconds,
            a.notion_last_edited,
          )
          .run();
        results.articles++;
      } catch (e) {
        errors.push(
          `article ${a.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // Upsert panels
  if (body.panels?.length) {
    for (const p of body.panels) {
      try {
        await env.DB.prepare(
          `
          INSERT OR REPLACE INTO panels
          (id, article_id, panel_order, image_url,
           image_width, image_height, transcript,
           ai_context, notion_last_edited, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
        )
          .bind(
            p.id,
            p.article_id,
            p.panel_order,
            p.image_url,
            p.image_width,
            p.image_height,
            p.transcript,
            p.ai_context,
            p.notion_last_edited,
          )
          .run();
        results.panels++;
      } catch (e) {
        errors.push(
          `panel ${p.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // Invalidate KV cache
  const cacheKeys: string[] = ["grid:clusters"];
  if (body.articles?.length) {
    for (const a of body.articles) {
      cacheKeys.push(`article:${a.slug}`);
    }
  }
  if (body.panels?.length) {
    // Collect unique article IDs from panels to invalidate article caches
    const articleIds = [...new Set(body.panels.map((p) => p.article_id))];
    for (const aid of articleIds) {
      cacheKeys.push(`panels:${aid}`);
    }
  }

  if (env.CACHE) {
    await Promise.all(cacheKeys.map((key) => env.CACHE.delete(key)));
  }

  return Response.json({
    ok: true,
    results,
    cache_invalidated: cacheKeys.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
