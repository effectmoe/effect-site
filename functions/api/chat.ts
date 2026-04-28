interface Env {
  AI: Ai;
  brain_knowledge: D1Database;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `あなたはEFFECTのAIアシスタントです。EFFECTはAI・LLMO（LLM最適化）・デジタル戦略を専門とするフルサービスエージェンシーです。

ユーザーの質問に対し、提供されたナレッジベース（D1構造化データ）を参照して回答してください。

回答ルール:
- 日本語で回答する
- 簡潔・明確に（200字以内を目安）
- ナレッジベースに情報があれば必ず活用する
- EFFECTのサービスに関する問い合わせは /contact へ誘導する
- 範囲外の質問には「EFFECTの専門外ですが...」と前置きして回答する`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as { message: string; history?: Message[] };
    const { message, history = [] } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'メッセージが空です' }), { status: 400 });
    }

    // D1から関連コンテンツをFTS検索
    const searchTerms = message.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    const ftsResult = await env.brain_knowledge.prepare(`
      SELECT a.id, a.collection, a.title, a.description, a.content, a.category, a.tags, a.date
      FROM articles_fts f
      JOIN articles a ON a.id = f.id
      WHERE articles_fts MATCH ?
      ORDER BY rank
      LIMIT 3
    `).bind(searchTerms || message).all().catch(() => ({ results: [] }));

    // FTS結果なし → 全件から最新3件をフォールバック
    const rows = ftsResult.results.length > 0
      ? ftsResult.results
      : (await env.brain_knowledge.prepare(
          'SELECT id, collection, title, description, content, category, tags, date FROM articles WHERE draft=0 ORDER BY date DESC LIMIT 3'
        ).all()).results;

    // 構造化コンテキスト構築（D1の構造化データをそのまま渡す）
    const context_str = rows.map((r: any) => [
      `## ${r.title}`,
      r.category ? `カテゴリ: ${r.category}` : '',
      r.tags ? `タグ: ${JSON.parse(r.tags).join(', ')}` : '',
      r.date ? `公開日: ${r.date}` : '',
      r.description ? `概要: ${r.description}` : '',
      r.content ? `\n${r.content.slice(0, 1200)}` : '',
    ].filter(Boolean).join('\n')).join('\n\n---\n\n');

    // 会話履歴 + 現在のメッセージ構築
    const messages: RoleScopedChatInput[] = [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user',
        content: context_str
          ? `[ナレッジベース参照]\n${context_str}\n\n---\n\n質問: ${message}`
          : message,
      },
    ];

    // Workers AI 呼び出し（ストリーミング）
    const aiResponse = await env.AI.run('@cf/qwen/qwen1.5-14b-chat-awq', {
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_tokens: 512,
    } as any);

    return new Response(aiResponse as ReadableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
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
