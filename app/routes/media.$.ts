/**
 * GET /media/*
 * Serves R2 objects (images, audio) with proper content-type and caching.
 * Splat route catches all paths under /media/.
 */
import type { Route } from "./+types/media.$";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  if (!env.MEDIA) {
    return new Response("Media storage not available", { status: 503 });
  }

  // Splat param contains the full path after /media/
  const key = params["*"];
  if (!key || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.MEDIA.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream",
  );
  // Cache for 1 year (immutable content-addressed by path)
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
