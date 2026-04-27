/**
 * GET /api/crawler-stats?date=2026-04-28
 * R2 に蓄積したAIクローラーログを集計して返す。
 */
export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (!env.CRAWLER_LOGS) {
    return Response.json({ success: false, error: "R2 not bound" }, { headers: cors });
  }

  try {
    const listed = await env.CRAWLER_LOGS.list({ prefix: `logs/${date}/` });

    const stats = {};
    for (const obj of listed.objects) {
      // key: logs/2026-04-28/GPTBot/xxx.json
      const parts = obj.key.split("/");
      const crawler = parts[2];
      if (!stats[crawler]) stats[crawler] = { count: 0, paths: {} };
      stats[crawler].count++;
    }

    // 上位パスの詳細取得（最新10件まで）
    const recent = listed.objects.slice(-20);
    const entries = [];
    for (const obj of recent) {
      const raw = await env.CRAWLER_LOGS.get(obj.key);
      if (raw) entries.push(JSON.parse(await raw.text()));
    }

    return Response.json({
      success: true,
      date,
      total: listed.objects.length,
      by_crawler: stats,
      recent: entries.reverse(),
    }, { headers: cors });

  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: cors });
  }
}
