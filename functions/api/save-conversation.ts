interface Env {
  brain_knowledge: D1Database;
  GAS_GMAIL_URL?: string;
  COMMANDC_PWA_URL?: string;  // commandc-pwa へのコンテンツシグナル通知先
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const { messages, email } = await request.json() as { messages: Message[]; email?: string };

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'messages is empty' }), { status: 400 });
    }

    // D1に会話を保存
    const id = crypto.randomUUID();
    await env.brain_knowledge.prepare(
      'INSERT INTO conversations (id, email, messages, created_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(id, email ?? null, JSON.stringify(messages)).run().catch(() => null);

    // Gmail送信（GAS Webhook 経由）
    if (email && env.GAS_GMAIL_URL) {
      const logText = messages.map((m) =>
        `${m.role === 'user' ? '【あなた】' : '【EFFECT AI】'}\n${m.content}`
      ).join('\n\n');

      const html = `<div style="font-family:monospace;font-size:15px;color:#333;max-width:600px;margin:0 auto;padding:36px;">
  <p style="font-size:12px;letter-spacing:.1em;color:#999;text-transform:uppercase;margin-bottom:28px;">Effect AI — 会話ログ</p>
  ${messages.map((m) => `
  <div style="margin-bottom:24px;${m.role === 'user' ? 'text-align:right;' : ''}">
    <span style="font-size:11px;letter-spacing:.1em;color:#bbb;text-transform:uppercase;display:block;margin-bottom:5px;">${m.role === 'user' ? 'YOU' : 'EFFECT AI'}</span>
    <span style="font-size:15px;color:${m.role === 'user' ? '#333' : '#666'};line-height:1.8;">${m.content.replace(/\n/g, '<br>')}</span>
  </div>`).join('')}
  <hr style="border:none;border-top:1px solid #eee;margin:36px 0;">
  <p style="font-size:12px;color:#ccc;">effect.moe</p>
</div>`;

      await fetch(env.GAS_GMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_gmail',
          to: email,
          subject: 'Effect AI との会話ログ',
          body: logText,
          html_body: html,
          from_name: 'EFFECT AI',
        }),
      }).catch(() => null);
    }

    // commandc-pwa にコンテンツシグナルを非同期送信（fire-and-forget）
    const pwaUrl = env.COMMANDC_PWA_URL || 'https://pwa.effect.moe';
    context.waitUntil(
      fetch(`${pwaUrl}/api/content-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'chatbot',
          conversation_id: id,
          messages,
          email: email ?? null,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => null)
    );

    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
