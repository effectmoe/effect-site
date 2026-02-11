import type { Route } from "./+types/api.chat";

// Simple keyword-based FAQ matching (fallback when OpenClaw Gateway is unavailable)
const STATIC_FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["llmo", "what", "とは"],
    answer:
      "LLMO (Large Language Model Optimization) は、AIチャットボットや検索エンジンのAI回答に自サイトの情報が引用されやすくするための最適化手法です。SEOのAI版と考えるとわかりやすいです。",
  },
  {
    keywords: ["llms.txt", "llms"],
    answer:
      "llms.txt は、AIクローラーがサイト構造を理解しやすくするためのファイルです。robots.txt のAI版のようなもので、サイトの要約をMarkdown形式で提供します。effect.moe では /llms.txt で公開しています。",
  },
  {
    keywords: ["json-ld", "structured", "構造化"],
    answer:
      "JSON-LD は Schema.org の構造化データ形式です。検索エンジンやAIがページの内容を正確に理解するために使われます。effect.moe では全ページに Article, BreadcrumbList 等の JSON-LD を自動生成しています。",
  },
  {
    keywords: ["dx", "デジタル", "digital"],
    answer:
      "DX (Digital Transformation) は、デジタル技術を活用してビジネスプロセスや顧客体験を変革することです。effect.moe ではAIを活用したDXの実践事例を紹介しています。",
  },
  {
    keywords: ["effect", "このサイト", "about"],
    answer:
      "effect.moe は LLMO & DX に特化したメディアサイトです。AI検索時代のWebマーケティング手法を研究・発信しています。サイト自体がLLMO実践の実験場でもあります。",
  },
];

function findFaqAnswer(message: string): string | null {
  const lower = message.toLowerCase();
  for (const faq of STATIC_FAQ) {
    if (faq.keywords.some((kw) => lower.includes(kw))) {
      return faq.answer;
    }
  }
  return null;
}

/**
 * Try OpenClaw Gateway (Ollama) for AI-powered chat responses.
 * Returns null if the gateway is unavailable or not configured.
 */
async function tryGatewayChat(
  message: string,
  gatewayUrl: string,
): Promise<{ reply: string; source: string } | null> {
  if (!gatewayUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${gatewayUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as { reply?: string; source?: string };
    if (data.reply) {
      return { reply: data.reply, source: data.source || "ollama" };
    }
  } catch {
    // Gateway unavailable or timed out, fall through to FAQ
  }
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const message = body?.message;

  if (!message || typeof message !== "string") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const env = context.cloudflare.env;

  // 1. Try OpenClaw Gateway (Ollama) for AI-powered responses
  const gatewayUrl = env.CHAT_GATEWAY_URL;
  const gatewayResult = await tryGatewayChat(message, gatewayUrl || "");
  if (gatewayResult) {
    return Response.json(gatewayResult);
  }

  // 2. Try D1 FAQ cache
  if (env.DB) {
    try {
      const result = await env.DB.prepare(
        "SELECT answer FROM faq_cache WHERE question LIKE ? LIMIT 1",
      )
        .bind(`%${message.slice(0, 50)}%`)
        .first();

      if (result?.answer) {
        return Response.json({
          reply: result.answer as string,
          source: "faq_cache",
        });
      }
    } catch {
      // D1 not available, continue to static FAQ
    }
  }

  // 3. Static FAQ fallback
  const faqAnswer = findFaqAnswer(message);
  if (faqAnswer) {
    return Response.json({ reply: faqAnswer, source: "static_faq" });
  }

  // 4. Default response when no match found
  return Response.json({
    reply: "ご質問ありがとうございます。現在AIアシスタントを準備中です。LLMO・DXに関する詳しい情報は記事一覧をご覧ください。",
    source: "default",
  });
}
