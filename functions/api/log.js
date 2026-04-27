/**
 * POST /api/log
 * 訪問者のインタラクションを D1 に非同期記録
 *
 * Body (JSON):
 *   { query?: string, page?: string, event_type?: string }
 */
export async function onRequestPost({ request, env }) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  try {
    const body       = await request.json().catch(() => ({}));
    const query      = body.query      || null;
    const page       = body.page       || null;
    const event_type = body.event_type || "pageview";
    const id         = crypto.randomUUID();
    const timestamp  = new Date().toISOString();

    const db = env.brain_knowledge;
    await db.prepare(
      "INSERT INTO interaction_logs (id, timestamp, query, page, event_type) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, timestamp, query, page, event_type).run();

    return Response.json({ success: true, id }, { headers: cors });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: cors });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
