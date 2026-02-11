import type { Route } from "./+types/llms[.]txt";
import { generateLlmsTxt } from "~/lib/llms-txt.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const content = await cached(
    env.CACHE,
    "llms-txt",
    () => generateLlmsTxt(env),
    3600,
  );

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
