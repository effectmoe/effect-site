import type { Route } from "./+types/api.chat";

// Simple keyword-based FAQ matching (fallback when AI is unavailable)
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
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface ChunkRow {
  article_title: string;
  article_slug: string;
  chunk_text: string;
  embedding: string;
}

/**
 * RAG: Find top-k similar article chunks for a query.
 * Optionally filter by article_slug to restrict scope.
 */
async function findSimilarChunks(
  db: D1Database,
  ai: Ai,
  query: string,
  topK = 3,
  slugFilter?: string,
): Promise<Array<{ title: string; slug: string; text: string; score: number }>> {
  // Embed the query
  const embResult = await ai.run("@cf/baai/bge-base-en-v1.5", {
    text: [query],
  });
  const queryEmb = embResult?.data?.[0];
  if (!queryEmb) return [];

  // Fetch chunks with embeddings (optionally filtered by slug)
  const rows = slugFilter
    ? await db
        .prepare(
          "SELECT article_title, article_slug, chunk_text, embedding FROM article_chunks WHERE embedding IS NOT NULL AND article_slug = ?",
        )
        .bind(slugFilter)
        .all()
    : await db
        .prepare(
          "SELECT article_title, article_slug, chunk_text, embedding FROM article_chunks WHERE embedding IS NOT NULL",
        )
        .all();

  if (!rows.results?.length) return [];

  // Compute similarities
  const scored = (rows.results as unknown as ChunkRow[])
    .map((row) => {
      const chunkEmb = JSON.parse(row.embedding) as number[];
      return {
        title: row.article_title,
        slug: row.article_slug,
        text: row.chunk_text,
        score: cosineSimilarity(queryEmb, chunkEmb),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Fetch dynamic system prompt from Prompt Gateway (Notion-managed).
 * Falls back to default prompt if gateway is unavailable.
 */
async function fetchSystemPrompt(
  gatewayUrl: string,
  apiKey: string,
): Promise<string | null> {
  if (!gatewayUrl || !apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `${gatewayUrl}/instructions?project=effect-site&task=chat-assistant&format=text`,
      {
        headers: { "X-API-Key": apiKey },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = await res.text();
    return text.trim() || null;
  } catch {
    return null;
  }
}

const DEFAULT_SYSTEM_PROMPT = `あなたはeffect.moe（LLMO & DXメディアサイト）のAIアシスタントです。
以下の記事コンテキストに基づいて、ユーザーの質問に日本語で簡潔に回答してください。
コンテキストに情報がない場合は「記事に該当する情報が見つかりませんでした」と正直に伝えてください。
回答は200文字以内でまとめてください。

【絶対に回答に含めないこと】
- 特定の企業名・会社名・商号・サービス名
- 個人名・担当者名
- 連絡先情報（電話番号・メールアドレス・URL等）
- 「相談」「問い合わせ」などの特定サービスへの誘導文言
- 情報の引用元・出典元の会社名やサービス名
一般的な知識と概念のみを用いて回答すること。`;

/**
 * Generate a response using Workers AI with RAG context.
 * System prompt is dynamically fetched from Prompt Gateway if available.
 */
async function generateRAGResponse(
  ai: Ai,
  query: string,
  chunks: Array<{ title: string; text: string }>,
  systemPrompt?: string | null,
): Promise<string> {
  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.title}:\n${c.text}`)
    .join("\n\n");

  const prompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const messages = [
    {
      role: "system" as const,
      content: `${prompt}\n\n--- 記事コンテキスト ---\n${context}`,
    },
    {
      role: "user" as const,
      content: query,
    },
  ];

  const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages,
    max_tokens: 300,
  });

  const response = (result as { response?: string })?.response;
  return response || "回答の生成に失敗しました。";
}

/**
 * Try Ollama (via public tunnel) for AI-powered chat responses.
 * Accepts an optional system prompt override (used to inject RAG context).
 * Timeout is short so downtime is detected quickly and falls through to Workers AI.
 */
async function tryGatewayChat(
  message: string,
  gatewayUrl: string,
  systemPromptOverride?: string,
): Promise<{ reply: string; source: string } | null> {
  if (!gatewayUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`${gatewayUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3-vl:8b-instruct",
        messages: [
          {
            role: "system",
            content: systemPromptOverride || DEFAULT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: message,
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as { message?: { content?: string } };
    const reply = data?.message?.content;
    if (reply) {
      return { reply, source: "ollama" };
    }
  } catch {
    // Ollama unavailable or timed out — fall through to Workers AI
  }
  return null;
}

/**
 * Direct Workers AI (Llama) response without RAG context.
 * Used as fallback when Ollama is down and no article chunks match.
 */
async function generateDirectResponse(
  ai: Ai,
  query: string,
): Promise<string | null> {
  try {
    const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system" as const,
          content: DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: "user" as const,
          content: query,
        },
      ],
      max_tokens: 300,
    });
    return (result as { response?: string })?.response || null;
  } catch {
    return null;
  }
}

// Minimum cosine similarity to inject context into Ollama prompt
const RAG_INJECT_THRESHOLD = 0.3;

// Minimum cosine similarity to trigger Workers AI RAG response
const RAG_WORKERS_THRESHOLD = 0.5;

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const message = body?.message;
  // Optional: panel transcript passed from manga reader to bias RAG query
  const pageContext = typeof body?.pageContext === "string" ? body.pageContext : "";

  if (!message || typeof message !== "string") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const env = context.cloudflare.env;

  // Build the effective RAG query: blend pageContext + message for better retrieval
  const ragQuery = pageContext ? `${pageContext}\n${message}` : message;

  // 0. RAG lookup — slug-filtered to the authorized external article only
  let ragChunks: Array<{ title: string; slug: string; text: string; score: number }> = [];
  let enrichedSystemPrompt: string | undefined;

  if (env.AI && env.DB) {
    try {
      const chunks = await findSimilarChunks(env.DB, env.AI, ragQuery, 3);
      if (chunks.length > 0 && chunks[0].score >= RAG_INJECT_THRESHOLD) {
        ragChunks = chunks;
        const contextText = chunks
          .map((c, i) => `[${i + 1}] ${c.title}:\n${c.text}`)
          .join("\n\n");
        const pageCtxSection = pageContext
          ? `\n\n--- 現在のページ内容 ---\n${pageContext.slice(0, 300)}`
          : "";
        enrichedSystemPrompt = `${DEFAULT_SYSTEM_PROMPT}${pageCtxSection}\n\n--- 参考情報 ---\n${contextText}`;
      } else if (pageContext) {
        // No RAG match, but inject page context alone
        enrichedSystemPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\n--- 現在のページ内容 ---\n${pageContext.slice(0, 300)}`;
      }
    } catch {
      // RAG unavailable, proceed without context
    }
  }

  const ragContextInfo =
    ragChunks.length > 0
      ? ragChunks.map((c) => ({
          title: c.title,
          slug: c.slug,
          score: Math.round(c.score * 100) / 100,
        }))
      : undefined;

  // 1. Try Ollama — inject RAG context into system prompt when available
  const gatewayUrl = env.CHAT_GATEWAY_URL;
  const gatewayResult = await tryGatewayChat(message, gatewayUrl || "", enrichedSystemPrompt);
  if (gatewayResult) {
    return Response.json({
      reply: gatewayResult.reply,
      source: enrichedSystemPrompt ? "ollama+rag" : "ollama",
      ...(ragContextInfo ? { context: ragContextInfo } : {}),
    });
  }

  // 2. Workers AI RAG — use pre-fetched chunks if confidence is high enough
  if (env.AI && env.DB && ragChunks.length > 0 && ragChunks[0].score >= RAG_WORKERS_THRESHOLD) {
    try {
      const systemPrompt = await fetchSystemPrompt(
        env.PROMPT_GATEWAY_URL || "",
        env.PROMPT_GATEWAY_KEY || "",
      );
      const reply = await generateRAGResponse(
        env.AI,
        message,
        ragChunks,
        systemPrompt || DEFAULT_SYSTEM_PROMPT,
      );
      return Response.json({
        reply,
        source: systemPrompt ? "rag+gateway" : "rag",
        ...(ragContextInfo ? { context: ragContextInfo } : {}),
      });
    } catch {
      // RAG response failed, continue to fallbacks
    }
  }

  // 3. Workers AI Llama direct (no RAG — Ollama was down and no chunks matched)
  if (env.AI) {
    const reply = await generateDirectResponse(env.AI, message);
    if (reply) {
      return Response.json({ reply, source: "workers-ai" });
    }
  }

  // 4. D1 FAQ cache
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
      // D1 not available
    }
  }

  // 5. Static FAQ fallback
  const faqAnswer = findFaqAnswer(message);
  if (faqAnswer) {
    return Response.json({ reply: faqAnswer, source: "static_faq" });
  }

  // 6. Default response
  return Response.json({
    reply: "ご質問ありがとうございます。LLMO・DXに関する詳しい情報は記事一覧をご覧ください。",
    source: "default",
  });
}
