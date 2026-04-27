/**
 * GET /api/articles
 * 外部AI・MCPエージェント向け記事メタデータ API
 *
 * クエリパラメータ:
 *   ?collection=articles|knowledge  コレクション絞り込み
 *   ?category=xxx                   カテゴリ絞り込み
 *   ?limit=20                       取得件数（最大100）
 *   ?id=xxx                         特定記事の取得
 */
export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const params = url.searchParams;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const db = env.brain_knowledge;

    // 単一記事取得
    if (params.get("id")) {
      const { results } = await db.prepare(
        `SELECT a.*, k.json_ld, k.ai_summary
         FROM articles a
         LEFT JOIN knowledge_graph k ON k.article_id = a.id
         WHERE a.id = ? AND a.draft = 0`
      ).bind(params.get("id")).all();

      if (!results.length) {
        return Response.json({ success: false, error: "Not found" }, { status: 404, headers: cors });
      }

      const row = results[0];
      row.tags = JSON.parse(row.tags || "[]");
      row.json_ld = row.json_ld ? JSON.parse(row.json_ld) : null;
      return Response.json({ success: true, article: row }, { headers: cors });
    }

    // 一覧取得
    const collection = params.get("collection") || null;
    const category   = params.get("category")   || null;
    const limit      = Math.min(parseInt(params.get("limit") || "20"), 100);

    let sql    = "SELECT id, slug, collection, title, description, category, tags, domain, date, updated FROM articles WHERE draft = 0";
    const bind = [];

    if (collection) { sql += " AND collection = ?"; bind.push(collection); }
    if (category)   { sql += " AND category = ?";   bind.push(category); }
    sql += " ORDER BY date DESC LIMIT ?";
    bind.push(limit);

    const { results } = await db.prepare(sql).bind(...bind).all();
    const articles = results.map(r => ({ ...r, tags: JSON.parse(r.tags || "[]") }));

    return Response.json({
      success: true,
      count: articles.length,
      articles,
    }, { headers: cors });

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: cors });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
