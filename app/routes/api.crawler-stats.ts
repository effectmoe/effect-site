import type { Route } from "./+types/api.crawler-stats";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  if (!env.DB) {
    return Response.json({ error: "D1 not configured" }, { status: 503 });
  }

  const stats = await env.DB.prepare(
    `SELECT company, crawler_name, COUNT(*) as visits, MAX(timestamp) as last_visit
     FROM crawler_logs
     GROUP BY company, crawler_name
     ORDER BY visits DESC`,
  ).all();

  const recent = await env.DB.prepare(
    `SELECT crawler_name, company, path, timestamp
     FROM crawler_logs
     ORDER BY timestamp DESC
     LIMIT 20`,
  ).all();

  return Response.json({ stats: stats.results, recent: recent.results });
}
