// ── Markdown → インラインスタイル付きHTML（メール用）──────────
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToEmailHtml(raw: string): string {
  // コードブロックを保護（先に退避）
  const codeBlocks: string[] = [];
  let s = raw.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => {
    codeBlocks.push(c.trimEnd());
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  s = esc(s);

  // コードブロック復元
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, i) =>
    `<pre style="background:#0a0a0a;color:#e5e5e5;padding:12px 16px;margin:12px 0;font-size:12px;line-height:1.6;border-left:3px solid #c2410c;font-family:monospace;">${esc(codeBlocks[+i])}</pre>`
  );

  // インラインコード
  s = s.replace(/`([^`\n]+)`/g, (_, c) =>
    `<code style="font-family:monospace;font-size:12px;color:#c2410c;background:rgba(194,65,12,.08);border:1px solid rgba(194,65,12,.2);padding:1px 5px;">${c}</code>`
  );

  // 見出し（4つ以上の # から順に処理）
  const hStyle = 'display:block;font-family:monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0a0a0a;border-left:3px solid #c2410c;padding-left:8px;margin:16px 0 6px;line-height:1.4;';
  s = s.replace(/^#{4,} (.+)$/gm, (_, t) => `<div style="${hStyle}">${t}</div>`);
  s = s.replace(/^### (.+)$/gm,   (_, t) => `<div style="${hStyle}">${t}</div>`);
  s = s.replace(/^## (.+)$/gm,    (_, t) => `<div style="${hStyle}font-size:13px;">${t}</div>`);
  s = s.replace(/^# (.+)$/gm,     (_, t) => `<div style="${hStyle}font-size:15px;">${t}</div>`);

  // マークダウンテーブル
  s = s.replace(
    /((?:\|.+\|\n?)+)/g,
    (block) => {
      const rows = block.trim().split('\n').filter(r => r.trim());
      if (rows.length < 2) return block;
      const isSep = (r: string) => /^\|[-| :]+\|$/.test(r.trim());
      const sepIdx = rows.findIndex(isSep);
      if (sepIdx < 0) return block;

      const toTd = (row: string, tag: string) =>
        row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1)
          .map(c => `<${tag} style="padding:6px 10px;border:1px solid #e5e5e5;font-size:13px;color:#333;text-align:left;">${c.trim()}</${tag}>`).join('');

      const headerRows = rows.slice(0, sepIdx).map(r => `<tr>${toTd(r,'th')}</tr>`).join('');
      const bodyRows   = rows.slice(sepIdx + 1).map(r => `<tr>${toTd(r,'td')}</tr>`).join('');
      return `<table style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px;"><thead style="background:#f5f5f5;">${headerRows}</thead><tbody>${bodyRows}</tbody></table>`;
    }
  );

  // 太字・斜体
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => `<strong><em>${t}</em></strong>`);
  s = s.replace(/\*\*(.+?)\*\*/g,     (_, t) => `<strong style="color:#0a0a0a;">${t}</strong>`);
  s = s.replace(/\*(.+?)\*/g,         (_, t) => `<em>${t}</em>`);

  // リンク
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
    `<a href="${u}" style="color:#c2410c;font-weight:700;text-decoration:underline;">${t}</a>`
  );

  // 番号付きリスト / 箇条書き
  const liStyle = 'padding-left:16px;margin:3px 0;color:#555;font-size:14px;line-height:1.7;';
  const bullet  = `<span style="color:#c2410c;font-weight:700;margin-right:6px;">—</span>`;
  s = s.replace(/^[-*] (.+)$/gm,   (_, t) => `<div style="${liStyle}">${bullet}${t}</div>`);
  s = s.replace(/^\d+\. (.+)$/gm,  (_, t) => `<div style="${liStyle}">${bullet}${t}</div>`);

  // 段落
  const blocks = s.split(/\n{2,}/);
  s = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<(div|pre|table|ul|ol)/.test(b)) return b;
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
