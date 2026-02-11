import type { Route } from "./+types/robots[.]txt";

export async function loader({ context }: Route.LoaderArgs) {
  const siteUrl = context.cloudflare.env.SITE_URL;
  const content = [
    "User-agent: *",
    "Allow: /",
    "",
    "# AI Crawlers Welcome",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: Claude-Web",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Applebot-Extended",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
    "# AI-readable site summary",
    `# See: ${siteUrl}/llms.txt`,
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
