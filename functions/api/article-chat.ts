interface Env {
  AI: Ai;
  brain_knowledge: D1Database;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ArticleContext {
  id: string;
  title: string;
  body: string;
}

const OUT_OF_SCOPE =
  'この質問は本記事の内容の範囲外です。記事に関することであれば何でもお気軽にどうぞ。';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as {
      message: string;
      history?: Message[];
      articleContext: ArticleContext;
    };
    const { message, history = [], articleContext } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'メッセージが空です' }), { status: 400 });
    }
    if (!articleContext?.title) {
      return new Response(JSON.stringify({ error: '記事コンテキストが必要です' }), { status: 400 });
    }

    // 記事本文は4000字に抑えてモデルの混乱を防ぐ
    const excerpt = (articleContext.body ?? '').slice(0, 4000);

    // ── シンプルで漏れにくいシステムプロンプト ──
    const systemPrompt =
      `You are an AI concierge for the article titled "${articleContext.title}". ` +
      `Answer questions about this article only. ` +
      `If asked about anything unrelated, reply in Japanese: "${OUT_OF_SCOPE}" ` +
      `Always answer in Japanese. Keep answers under 400 characters. ` +
      `Use the following article content as your only knowledge source:\n\n${excerpt}`;

    const messages: { role: string; content: string }[] = [
      ...history.slice(-4).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const aiResponse = await (env.AI.run as any)('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 800,
    });

    return new Response(aiResponse as ReadableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
