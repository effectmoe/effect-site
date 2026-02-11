import type { Route } from "./+types/api.chat";
import { getArticles, blocksToPlainText } from "~/lib/notion.server";
import { authenticateRequest } from "~/lib/auth.server";

const NOTION_API_BASE = "https://api.notion.com/v1";
const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 50;

/**
 * Split text into overlapping chunks for embedding.
 */
function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }
    start += size - overlap;
  }
  return chunks;
}

/**
 * Fetch page blocks as plain text from Notion.
 */
async function getPagePlainText(apiKey: string, pageId: string): Promise<string> {
  const res = await fetch(`${NOTION_API_BASE}/blocks/${pageId}/children?page_size=100`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { results: unknown[] };
  return blocksToPlainText(data.results as unknown[]);
}

/**
 * POST /api/index-articles
 * Fetches all published articles from Notion, chunks them,
 * generates embeddings via Workers AI, and stores in D1.
 *
 * Query params:
 *   ?force=true  - Re-index all articles (default: skip existing)
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;

  // Auth check
  const authError = authenticateRequest(request, env.ADMIN_API_KEY);
  if (authError) return authError;

  if (!env.DB || !env.AI) {
    return Response.json({ error: "DB or AI binding not available" }, { status: 503 });
  }

  const notionKey = env.NOTION_API_KEY;
  if (!notionKey) {
    return Response.json({ error: "NOTION_API_KEY not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  // 1. Fetch all published articles
  const articles = await getArticles(env as { NOTION_API_KEY: string; NOTION_DATABASE_ARTICLES: string });
  if (articles.length === 0) {
    return Response.json({ message: "No published articles found", indexed: 0 });
  }

  let totalChunks = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const article of articles) {
    try {
      // Check if already indexed (unless force)
      if (!force) {
        const existing = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM article_chunks WHERE article_id = ?",
        )
          .bind(article.id)
          .first();
        if (existing && (existing.count as number) > 0) {
          skipped++;
          continue;
        }
      }

      // Delete existing chunks for this article (re-index)
      await env.DB.prepare("DELETE FROM article_chunks WHERE article_id = ?")
        .bind(article.id)
        .run();

      // Fetch article content as plain text
      const content = await getPagePlainText(notionKey, article.id);
      if (!content) {
        errors.push(`${article.slug}: no content`);
        continue;
      }

      // Prepend metadata for better context
      const fullText = `${article.title}\n${article.description}\nCategory: ${article.category}\nTags: ${article.tags.join(", ")}\n\n${content}`;

      // Chunk the text
      const chunks = chunkText(fullText);

      // Generate embeddings for all chunks
      for (let i = 0; i < chunks.length; i++) {
        const embeddingResult = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
          text: [chunks[i]],
        });

        const embedding = embeddingResult?.data?.[0];
        if (!embedding) {
          errors.push(`${article.slug}[${i}]: embedding failed`);
          continue;
        }

        await env.DB.prepare(
          "INSERT OR REPLACE INTO article_chunks (article_id, article_title, article_slug, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?, ?, ?)",
        )
          .bind(
            article.id,
            article.title,
            article.slug || article.id,
            i,
            chunks[i],
            JSON.stringify(embedding),
          )
          .run();

        totalChunks++;
      }
    } catch (e) {
      errors.push(`${article.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({
    success: true,
    articles: articles.length,
    indexed: articles.length - skipped,
    skipped,
    totalChunks,
    errors: errors.length > 0 ? errors : undefined,
  });
}
