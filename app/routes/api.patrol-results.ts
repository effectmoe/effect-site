import type { Route } from "./+types/api.chat";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  if (!env.DB) {
    return Response.json({ error: "Database not available" }, { status: 503 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "daily";
  const limit = Math.min(Number(url.searchParams.get("limit") || "10"), 50);

  const results = await env.DB.prepare(
    "SELECT id, mode, timestamp, pages_ok, pages_total, endpoints_ok, endpoints_total, issues_count, summary, created_at FROM patrol_results WHERE mode = ? ORDER BY created_at DESC LIMIT ?",
  )
    .bind(mode, limit)
    .all();

  return Response.json({
    results: results.results,
    count: results.results.length,
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  if (!env.DB) {
    return Response.json({ error: "Database not available" }, { status: 503 });
  }

  const body = await request.json();

  const pages = body?.pages || [];
  const endpoints = body?.endpoints || [];
  const pagesOk = pages.filter((p: { error?: string }) => !p.error).length;
  const endpointsOk = endpoints.filter(
    (e: { status?: number }) => e.status === 200,
  ).length;

  let issuesCount = 0;
  if (body?.issues) {
    issuesCount = body.issues.length;
  }

  await env.DB.prepare(
    "INSERT INTO patrol_results (mode, timestamp, pages_ok, pages_total, endpoints_ok, endpoints_total, issues_count, summary, full_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      body?.mode || "daily",
      body?.timestamp || new Date().toISOString(),
      pagesOk,
      pages.length,
      endpointsOk,
      endpoints.length,
      issuesCount,
      body?.summary || null,
      JSON.stringify(body),
    )
    .run();

  return Response.json({ success: true });
}
