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

    const excerpt = (articleContext.body ?? '').slice(0, 8000);

    const systemPrompt = `あなたは記事「${articleContext.title}」専用のAIコンシェルジュです。
この記事の内容を深掘りして理解を助けることが唯一の役割です。

## 記事の全文（コンテキスト）
${excerpt}

## 厳守事項
- **必ず上記の記事内容に基づいて回答する**。記事に書かれている具体的な手順・設定・コードを優先して引用する
- 記事と無関係・記事が扱わないトピックへの質問には必ず「${OUT_OF_SCOPE}」とだけ返す
- 日本語で回答する（500字以内を目安）
- 実装方法・手順を聞かれたときは記事の該当セクションの内容を具体的に説明する
- EFFECTへの相談・依頼は /contact へ誘導する`;

    const messages: { role: string; content: string }[] = [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const aiResponse = await (env.AI.run as any)('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1024,
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
