/**
 * GET /robots.txt
 * Cloudflare の管理セクション（AI ブロック）を上書きして
 * 全 AI クローラーを明示的に許可する。
 */
export async function onRequestGet() {
  const content = `User-agent: *
Allow: /

# AI クローラー明示許可（LLMO最適化）
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: YouBot
Allow: /

User-agent: Applebot
Allow: /

Sitemap: https://effect.moe/sitemap-index.xml
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
