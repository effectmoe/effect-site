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

    const excerpt = (articleContext.body ?? '').slice(0, 4000);

    const systemPrompt =
      `あなたは記事「${articleContext.title}」の内容に詳しいAIアシスタントです。` +
      `以下の記事テキストを参照して、ユーザーの質問に日本語で答えてください。` +
      `必ず1200トークン以内に収まるよう、回答を完結させてください。コードブロックを書く場合は必ず閉じてください。` +
      `記事に書かれていない情報は「この記事には記載がありませんが、」と前置きして補足してください。\n\n` +
      `【記事テキスト】\n${excerpt}`;

    const messages: { role: string; content: string }[] = [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const aiResponse = await (env.AI.run as any)('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1200,
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
