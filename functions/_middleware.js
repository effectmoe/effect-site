/**
 * _middleware.js — AI クローラー監視ミドルウェア
 * effect.moe の全リクエストに対してAIクローラーを検出し、R2 に記録する。
 * 旧 OpenClaw ai-crawler.server.ts のパターンを Hermes/現構成向けに移植。
 */

const AI_CRAWLERS = [
  { name: "GPTBot",           pattern: "GPTBot" },
  { name: "ChatGPT-User",     pattern: "ChatGPT-User" },
  { name: "ClaudeBot",        pattern: "ClaudeBot" },
  { name: "anthropic-ai",     pattern: "anthropic-ai" },
  { name: "PerplexityBot",    pattern: "PerplexityBot" },
  { name: "Google-Extended",  pattern: "Google-Extended" },
  { name: "Googlebot",        pattern: "Googlebot" },
  { name: "Bingbot",          pattern: "bingbot" },
  { name: "BingPreview",      pattern: "BingPreview" },
  { name: "Bytespider",       pattern: "Bytespider" },
  { name: "CCBot",            pattern: "CCBot" },
  { name: "cohere-ai",        pattern: "cohere-ai" },
  { name: "YouBot",           pattern: "YouBot" },
  { name: "FacebookBot",      pattern: "FacebookBot" },
  { name: "Applebot",         pattern: "Applebot" },
  { name: "Diffbot",          pattern: "Diffbot" },
  { name: "ImagesiftBot",     pattern: "ImagesiftBot" },
  { name: "omgili",           pattern: "omgili" },
  { name: "Pinterestbot",     pattern: "Pinterestbot" },
  { name: "SemrushBot",       pattern: "SemrushBot" },
  { name: "AhrefsBot",        pattern: "AhrefsBot" },
  { name: "DotBot",           pattern: "DotBot" },
];

export async function onRequest(context) {
  const { request, env, next, waitUntil } = context;
  const response = await next();

  const ua  = request.headers.get("User-Agent") || "";
  const url = new URL(request.url);

  const crawler = AI_CRAWLERS.find(c =>
    ua.toLowerCase().includes(c.pattern.toLowerCase())
  );

  if (crawler && env.CRAWLER_LOGS) {
    const entry = {
      timestamp:  new Date().toISOString(),
      crawler:    crawler.name,
      path:       url.pathname,
      method:     request.method,
      userAgent:  ua,
      ip:         request.headers.get("CF-Connecting-IP") || "",
      referer:    request.headers.get("Referer") || "",
      statusCode: response.status,
    };

    const date = entry.timestamp.slice(0, 10);
    const key  = `logs/${date}/${crawler.name}/${Date.now()}_${Math.random().toString(36).slice(2)}.json`;

    // waitUntil でレスポンス返却後もR2書き込みを完了させる
    waitUntil(
      env.CRAWLER_LOGS.put(key, JSON.stringify(entry), {
        httpMetadata: { contentType: "application/json" },
      })
    );
  }

  return response;
}
