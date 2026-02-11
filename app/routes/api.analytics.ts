import type { Route } from "./+types/api.chat";

interface GA4Row {
  date: string;
  page_path: string;
  pageviews: number;
  sessions: number;
  users: number;
  avg_session_duration: number;
  bounce_rate: number;
}

interface GSCRow {
  date: string;
  page: string;
  query: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  if (!env.DB) {
    return Response.json({ error: "Database not available" }, { status: 503 });
  }

  const url = new URL(request.url);
  const source = url.searchParams.get("source") || "ga4";
  const days = Math.min(Number(url.searchParams.get("days") || "7"), 90);
  const page = url.searchParams.get("page");

  if (source === "ga4") {
    let query = "SELECT * FROM ga4_daily WHERE date >= date('now', ? || ' days') ";
    const params: (string | number)[] = [`-${days}`];
    if (page) {
      query += "AND page_path = ? ";
      params.push(page);
    }
    query += "ORDER BY date DESC, pageviews DESC LIMIT 500";

    const results = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ source: "ga4", results: results.results });
  }

  if (source === "gsc") {
    let query =
      "SELECT * FROM gsc_daily WHERE date >= date('now', ? || ' days') ";
    const params: (string | number)[] = [`-${days}`];
    if (page) {
      query += "AND page = ? ";
      params.push(page);
    }
    query += "ORDER BY date DESC, clicks DESC LIMIT 500";

    const results = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ source: "gsc", results: results.results });
  }

  return Response.json({ error: "Invalid source" }, { status: 400 });
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
  const source = body?.source;

  if (source === "ga4" && Array.isArray(body?.rows)) {
    let inserted = 0;
    for (const row of body.rows as GA4Row[]) {
      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO ga4_daily (date, page_path, pageviews, sessions, users, avg_session_duration, bounce_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
          .bind(
            row.date,
            row.page_path || "/",
            row.pageviews || 0,
            row.sessions || 0,
            row.users || 0,
            row.avg_session_duration || 0,
            row.bounce_rate || 0,
          )
          .run();
        inserted++;
      } catch (e) {
        // Skip duplicates
      }
    }
    return Response.json({ success: true, source: "ga4", inserted });
  }

  if (source === "gsc" && Array.isArray(body?.rows)) {
    let inserted = 0;
    for (const row of body.rows as GSCRow[]) {
      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO gsc_daily (date, page, query, clicks, impressions, ctr, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
          .bind(
            row.date,
            row.page || "/",
            row.query || null,
            row.clicks || 0,
            row.impressions || 0,
            row.ctr || 0,
            row.position || 0,
          )
          .run();
        inserted++;
      } catch (e) {
        // Skip duplicates
      }
    }
    return Response.json({ success: true, source: "gsc", inserted });
  }

  return Response.json(
    { error: "Invalid source or missing rows" },
    { status: 400 },
  );
}
