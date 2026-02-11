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
 */
async function findSimilarChunks(
  db: D1Database,
  ai: Ai,
  query: string,
  topK = 3,
): Promise<Array<{ title: string; slug: string; text: string; score: number }>> {
  // Embed the query
  const embResult = await ai.run("@cf/baai/bge-base-en-v1.5", {
    text: [query],
  });
  const queryEmb = embResult?.data?.[0];
  if (!queryEmb) return [];

  // Fetch all chunks with embeddings
  const rows = await db
    .prepare("SELECT article_title, article_slug, chunk_text, embedding FROM article_chunks WHERE embedding IS NOT NULL")
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
 * Generate a response using Workers AI with RAG context.
 */
async function generateRAGResponse(
  ai: Ai,
  query: string,
  chunks: Array<{ title: string; text: string }>,
): Promise<string> {
  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.title}:\n${c.text}`)
    .join("\n\n");

  const messages = [
    {
      role: "system" as const,
      content: `あなたはeffect.moe（LLMO & DXメディアサイト）のAIアシスタントです。
以下の記事コンテキストに基づいて、ユーザーの質問に日本語で簡潔に回答してください。
コンテキストに情報がない場合は「記事に該当する情報が見つかりませんでした」と正直に伝えてください。
回答は200文字以内でまとめてください。

--- 記事コンテキスト ---
${context}`,
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

  // Workers AI returns { response: string } for text generation
  const response = (result as { response?: string })?.response;
  return response || "回答の生成に失敗しました。";
}

/**
 * Try OpenClaw Gateway (Ollama) for AI-powered chat responses.
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
    // Gateway unavailable or timed out
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

  // 1. Try OpenClaw Gateway (Ollama) if configured
  const gatewayUrl = env.CHAT_GATEWAY_URL;
  const gatewayResult = await tryGatewayChat(message, gatewayUrl || "");
  if (gatewayResult) {
    return Response.json(gatewayResult);
  }

  // 2. Try RAG with Workers AI + article embeddings
  if (env.AI && env.DB) {
    try {
      const chunks = await findSimilarChunks(env.DB, env.AI, message, 3);
      if (chunks.length > 0 && chunks[0].score > 0.5) {
        const reply = await generateRAGResponse(env.AI, message, chunks);
        return Response.json({
          reply,
          source: "rag",
          context: chunks.map((c) => ({
            title: c.title,
            slug: c.slug,
            score: Math.round(c.score * 100) / 100,
          })),
        });
      }
    } catch {
      // RAG failed, continue to fallbacks
    }
  }

  // 3. Try D1 FAQ cache
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

  // 4. Static FAQ fallback
  const faqAnswer = findFaqAnswer(message);
  if (faqAnswer) {
    return Response.json({ reply: faqAnswer, source: "static_faq" });
  }

  // 5. Default response
  return Response.json({
    reply: "ご質問ありがとうございます。LLMO・DXに関する詳しい情報は記事一覧をご覧ください。",
    source: "default",
  });
}
