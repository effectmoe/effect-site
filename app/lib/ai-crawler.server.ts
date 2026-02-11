const AI_CRAWLERS: Record<string, string> = {
  "GPTBot": "OpenAI",
  "ChatGPT-User": "OpenAI",
  "OAI-SearchBot": "OpenAI",
  "Claude-Web": "Anthropic",
  "ClaudeBot": "Anthropic",
  "Anthropic": "Anthropic",
  "Google-Extended": "Google",
  "Gemini": "Google",
  "CCBot": "CommonCrawl",
  "PerplexityBot": "Perplexity",
  "Bytespider": "ByteDance",
  "Applebot-Extended": "Apple",
  "Amazonbot": "Amazon",
  "meta-externalagent": "Meta",
  "FacebookBot": "Meta",
  "cohere-ai": "Cohere",
  "YouBot": "You.com",
  "Diffbot": "Diffbot",
  "ImagesiftBot": "Imagesift",
  "Timpibot": "Timpi",
};

export interface CrawlerInfo {
  isAiCrawler: boolean;
  crawlerName: string | null;
  company: string | null;
}

export function detectAiCrawler(userAgent: string): CrawlerInfo {
  if (!userAgent)
    return { isAiCrawler: false, crawlerName: null, company: null };

  for (const [pattern, company] of Object.entries(AI_CRAWLERS)) {
    if (userAgent.includes(pattern)) {
      return { isAiCrawler: true, crawlerName: pattern, company };
    }
  }

  return { isAiCrawler: false, crawlerName: null, company: null };
}

export async function logCrawlerVisit(
  db: D1Database | undefined,
  crawlerInfo: CrawlerInfo,
  request: Request,
): Promise<void> {
  if (!db || !crawlerInfo.isAiCrawler) return;

  const url = new URL(request.url);
  try {
    await db
      .prepare(
        `INSERT INTO crawler_logs (crawler_name, company, path, timestamp, user_agent, ip)
       VALUES (?, ?, ?, datetime('now'), ?, ?)`,
      )
      .bind(
        crawlerInfo.crawlerName,
        crawlerInfo.company,
        url.pathname,
        request.headers.get("User-Agent") ?? "",
        request.headers.get("CF-Connecting-IP") ?? "",
      )
      .run();
  } catch (e) {
    console.error("Failed to log crawler visit:", e);
  }
}
