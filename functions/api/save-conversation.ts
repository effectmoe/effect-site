// ── Markdown → インラインスタイル付きHTML（メール用）──────────
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function mdToEmailHtml(raw: string): string {
  let s = esc(raw);
  // コードブロック
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) =>
    `<pre style="background:#0a0a0a;color:#e5e5e5;padding:12px 16px;margin:10px 0;font-size:13px;line-height:1.6;overflow-x:auto;border-left:3px solid #c2410c;">${c.trimEnd()}</pre>`
  );
  // インラインコード
  s = s.replace(/`([^`\n]+)`/g,
    '<code style="font-family:monospace;font-size:13px;color:#c2410c;background:rgba(194,65,12,0.08);border:1px solid rgba(194,65,12,0.2);padding:1px 5px;">$1</code>'
  );
  // 見出し
  const headingStyle = 'font-family:monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0a0a0a;border-left:3px solid #c2410c;padding-left:8px;margin:16px 0 6px;';
  s = s.replace(/^### (.+)$/gm, `<div style="${headingStyle}">$1</div>`);
  s = s.replace(/^## (.+)$/gm,  `<div style="${headingStyle}">$1</div>`);
  s = s.replace(/^# (.+)$/gm,   `<div style="${headingStyle}">$1</div>`);
  // 太字・斜体
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0a0a0a;">$1</strong>');
  s = s.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  // リンク
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#c2410c;font-weight:700;text-decoration:underline;">$1</a>'
  );
  // リスト
  s = s.replace(/^[-*] (.+)$/gm,
    '<div style="padding-left:16px;margin:3px 0;color:#555;font-size:14px;line-height:1.7;"><span style="color:#c2410c;font-weight:700;margin-right:6px;">—</span>$1</div>'
  );
  s = s.replace(/^\d+\. (.+)$/gm,
    '<div style="padding-left:16px;margin:3px 0;color:#555;font-size:14px;line-height:1.7;"><span style="color:#c2410c;font-weight:700;margin-right:6px;">—</span>$1</div>'
  );
  // 段落
  const blocks = s.split(/\n{2,}/);
  s = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (b.startsWith('<')) return b;
    return `<p style="margin:6px 0;font-size:14px;line-height:1.8;color:#555;">${b.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return s;
}
// ──────────────────────────────────────────────────────────────

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
    const { messages, email, articleTitle } = await request.json() as {
      messages: Message[];
      email?: string;
      articleTitle?: string;
    };

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
      const subject = articleTitle
        ? `「${articleTitle}」の記事コンシェルジュ会話ログ`
        : 'Effect AI との会話ログ';

      const contextBadge = articleTitle
        ? `<p style="font-size:11px;letter-spacing:.08em;color:#aaa;margin-bottom:4px;">記事：${articleTitle}</p>`
        : '';

      const logText = messages.map((m) =>
        `${m.role === 'user' ? '【あなた】' : '【EFFECT AI】'}\n${m.content}`
      ).join('\n\n');

      const html = `<div style="font-family:monospace;font-size:15px;color:#333;max-width:600px;margin:0 auto;padding:36px;">
  <p style="font-size:12px;letter-spacing:.1em;color:#999;text-transform:uppercase;margin-bottom:8px;">Effect AI — 会話ログ</p>
  ${contextBadge}
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0 28px;">
  ${messages.map((m) => {
        const isUser = m.role === 'user';
        const body = isUser
          ? `<div style="font-size:14px;color:#333;line-height:1.8;text-align:right;">${esc(m.content).replace(/\n/g,'<br>')}</div>`
          : `<div style="font-size:14px;line-height:1.8;">${mdToEmailHtml(m.content)}</div>`;
        return `
  <div style="margin-bottom:28px;${isUser ? 'text-align:right;' : ''}">
    <span style="font-family:monospace;font-size:10px;letter-spacing:.12em;color:#bbb;text-transform:uppercase;display:block;margin-bottom:6px;">${isUser ? 'YOU' : 'EFFECT AI'}</span>
    ${isUser ? `<div style="display:inline-block;background:#0a0a0a;color:#fff;padding:8px 14px;font-size:13px;line-height:1.7;max-width:85%;">${esc(m.content).replace(/\n/g,'<br>')}</div>` : body}
  </div>`;
      }).join('')}
  <hr style="border:none;border-top:1px solid #eee;margin:36px 0;">
  <p style="font-size:12px;color:#ccc;">effect.moe</p>
</div>`;

      await fetch(env.GAS_GMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_gmail',
          to: email,
          subject,
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
