/**
 * POST /api/sync/media
 * Binary upload to R2 for manga panel images and audio files.
 * Called by n8n sync workflow.
 *
 * Required headers:
 *   Authorization: Bearer <ADMIN_API_KEY>
 *   X-R2-Path: manga/{slug}/panel-{order}.webp
 *   Content-Type: image/webp | audio/mpeg | etc.
 *
 * Returns: { r2_url: "https://media.effect.moe/..." }
 */
import type { Route } from "./+types/api.sync.media";
import { authenticateRequest } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;

  // Auth check
  const authError = authenticateRequest(request, env.ADMIN_API_KEY);
  if (authError) return authError;

  // R2 binding check
  if (!env.MEDIA) {
    return Response.json(
      { error: "MEDIA R2 binding not available" },
      { status: 503 },
    );
  }

  // Validate required header
  const r2Path = request.headers.get("x-r2-path");
  if (!r2Path) {
    return Response.json(
      { error: "x-r2-path header required" },
      { status: 400 },
    );
  }

  // Validate path format (prevent directory traversal)
  if (r2Path.includes("..") || r2Path.startsWith("/")) {
    return Response.json({ error: "Invalid r2 path" }, { status: 400 });
  }

  const contentType =
    request.headers.get("content-type") ?? "application/octet-stream";

  // Stream binary directly to R2
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }

  await env.MEDIA.put(r2Path, body, {
    httpMetadata: { contentType },
  });

  // Public URL assumes R2 custom domain or public bucket
  const publicUrl = `https://media.effect.moe/${r2Path}`;

  return Response.json({
    r2_url: publicUrl,
    size: body.byteLength,
    content_type: contentType,
  });
}
