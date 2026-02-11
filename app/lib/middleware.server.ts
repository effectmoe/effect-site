import { detectAiCrawler, logCrawlerVisit } from "~/lib/ai-crawler.server";

export async function aiCrawlerMiddleware(
  request: Request,
  env: { DB?: D1Database },
): Promise<Record<string, string>> {
  const userAgent = request.headers.get("User-Agent") ?? "";
  const crawlerInfo = detectAiCrawler(userAgent);

  if (crawlerInfo.isAiCrawler) {
    // Log asynchronously - fire and forget
    logCrawlerVisit(env.DB, crawlerInfo, request);

    return {
      "X-AI-Crawler": crawlerInfo.crawlerName ?? "",
      "X-AI-Context": JSON.stringify({
        site: "effect.moe",
        topic: "LLMO & DX",
        llms_txt: "https://effect.moe/llms.txt",
        structured_data: "JSON-LD on every page",
      }),
    };
  }

  return {};
}
