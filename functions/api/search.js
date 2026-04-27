/**
 * GET /api/search?q=クエリ
 * D1 FTS5 による全文検索 API
 *
 * クエリパラメータ:
 *   ?q=xxx       検索キーワード（必須）
 *   ?limit=10    取得件数（最大50）
 */
export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const q     = url.searchParams.get("q") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!q.trim()) {
    return Response.json({ success: false, error: "q parameter required" }, { status: 400, headers: cors });
  }

  try {
    const db = env.brain_knowledge;

    // FTS5 全文検索
    const { results } = await db.prepare(`
      SELECT a.id, a.slug, a.collection, a.title, a.description, a.category, a.tags, a.date,
             k.json_ld
      FROM articles_fts f
      JOIN articles a ON a.id = f.id
      LEFT JOIN knowledge_graph k ON k.article_id = a.id
      WHERE articles_fts MATCH ? AND a.draft = 0
      ORDER BY rank
      LIMIT ?
    `).bind(q, limit).all();

    const articles = results.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || "[]"),
      json_ld: r.json_ld ? JSON.parse(r.json_ld) : null,
    }));

    return Response.json({
      success: true,
      query: q,
      count: articles.length,
      articles,
    }, { headers: cors });

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: cors });
  }
}
