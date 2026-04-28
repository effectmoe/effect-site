interface Env {
  brain_knowledge: D1Database;
  GAS_GMAIL_URL?: string;
}

const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Claude-Web',
  'PerplexityBot', 'Googlebot-Extended', 'cohere-ai', 'YouBot',
  'Applebot-Extended', 'Bytespider', 'DataForSeoBot',
];

// Minimum required Google Rich Results properties per type
const REQUIRED_PROPS: Record<string, string[]> = {
  Article:            ['headline', 'author', 'datePublished'],
  NewsArticle:        ['headline', 'author', 'datePublished'],
  BlogPosting:        ['headline', 'author', 'datePublished'],
  Product:            ['name'],
  Review:             ['itemReviewed', 'reviewRating', 'author'],
  FAQPage:            ['mainEntity'],
  HowTo:              ['name', 'step'],
  Event:              ['name', 'startDate', 'location'],
  Recipe:             ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
  LocalBusiness:      ['name', 'address'],
  Organization:       ['name'],
  Person:             ['name'],
  VideoObject:        ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  BreadcrumbList:     ['itemListElement'],
  JobPosting:         ['title', 'description', 'hiringOrganization', 'datePosted'],
  SoftwareApplication:['name', 'operatingSystem', 'applicationCategory'],
};

// ── Helpers ───────────────────────────────────────────────────────

async function fetchSafe(url: string, timeout = 6000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'EFFECT-AI-Analyzer/1.0 (https://effect.moe)' },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Analyzers ─────────────────────────────────────────────────────

async function analyzeRobots(origin: string) {
  const res = await fetchSafe(`${origin}/robots.txt`);
  if (!res?.ok) {
    return { exists: false, score: 0, aiAllowed: false, blockedBots: [] as string[], message: 'robots.txtが見つかりません' };
  }

  const text = await res.text();
  const agentRules = new Map<string, string[]>();
  let current: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      const agent = line.slice(11).trim();
      current.push(agent);
      if (!agentRules.has(agent)) agentRules.set(agent, []);
    } else if (lower.startsWith('disallow:')) {
      const path = line.slice(9).trim();
      current.forEach(a => agentRules.get(a)?.push(path));
    } else if (!line) {
      current = [];
    }
  }

  const globalDisallow = agentRules.get('*') ?? [];
  const blockedBots = AI_BOTS.filter(bot => {
    const rules = agentRules.get(bot) ?? globalDisallow;
    return rules.some(p => p === '/' || p === '/*');
  });

  const aiAllowed = blockedBots.length === 0;
  const score = aiAllowed ? 20 : blockedBots.length < 4 ? 8 : 3;

  return {
    exists: true, score, aiAllowed,
    blockedBots: blockedBots.slice(0, 5),
    message: aiAllowed
      ? 'AIクローラーのアクセスが許可されています'
      : `${blockedBots.length}件のAIボットがブロック中（${blockedBots.slice(0, 3).join(', ')}…）`,
  };
}

async function analyzeLlms(origin: string) {
  const res = await fetchSafe(`${origin}/llms.txt`);
  if (!res?.ok) {
    return { exists: false, score: 0, size: 0, entryCount: 0, preview: '', message: 'llms.txtが見つかりません（LLMO対策に必須）' };
  }

  const text = await res.text();
  const size = new TextEncoder().encode(text).length;
  const entries = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));

  if (size === 0 || entries.length === 0) {
    return { exists: false, score: 0, size: 0, entryCount: 0, preview: '', message: 'llms.txtが空です（コンテンツの追加が必要です）' };
  }

  let score = 20;
  if (entries.length >= 5) score += 12;
  else if (entries.length > 0) score += 8;
  if (size > 500) score += 8;

  return {
    exists: true,
    score: Math.min(score, 40),
    size, entryCount: entries.length,
    preview: text.slice(0, 200).replace(/\n+/g, ' ').trim(),
    message: `llms.txtを検出（${entries.length}エントリ・${size}バイト）`,
  };
}

async function analyzeSitemap(origin: string) {
  const res = await fetchSafe(`${origin}/sitemap.xml`);
  if (!res?.ok) {
    return { exists: false, score: 0, urlCount: 0, message: 'sitemap.xmlが見つかりません' };
  }

  const text = await res.text();
  const urlCount = (text.match(/<loc>/g) ?? []).length;

  return { exists: true, score: 10, urlCount, message: `sitemap.xmlを検出（${urlCount} URL）` };
}

async function analyzePage(url: string) {
  const none = {
    metaTags:       { score: 0, title: '', description: '', hasOgp: false, message: 'ページを取得できませんでした' },
    structuredData: { score: 0, schemasFound: 0, schemas: [] as SchemaEntry[], message: 'ページを取得できませんでした' },
  };

  const res = await fetchSafe(url, 9000);
  if (!res?.ok) return none;

  const html = await res.text();

  // ── Meta tags ──────────────────────────────────────────────────
  const title = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() ?? '';
  const desc = (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,200})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{1,200})["'][^>]+name=["']description["']/i)
  )?.[1]?.trim() ?? '';
  const hasOgp = html.includes('og:title') || html.includes('og:description');
  const metaScore = (title ? 4 : 0) + (desc ? 4 : 0) + (hasOgp ? 2 : 0);

  // ── Structured data ────────────────────────────────────────────
  const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const schemas: SchemaEntry[] = [];

  for (const m of html.matchAll(jsonLdRe)) {
    try {
      const items = (() => { const d = JSON.parse(m[1]); return Array.isArray(d) ? d : [d]; })();
      for (const item of items) {
        const rawType = item['@type'];
        if (!rawType) continue;
        const type = Array.isArray(rawType) ? rawType[0] : rawType;

        const issues: { sev: 'error' | 'warning'; msg: string }[] = [];

        if (!item['@context']) {
          issues.push({ sev: 'warning', msg: '@contextが設定されていません' });
        }

        for (const prop of REQUIRED_PROPS[type] ?? []) {
          if (!(prop in item) || item[prop] == null || item[prop] === '') {
            issues.push({ sev: 'error', msg: `必須プロパティ "${prop}" がありません` });
          }
        }

        if ((type === 'Article' || type === 'BlogPosting') && item.headline?.length > 110) {
          issues.push({ sev: 'warning', msg: `headline が ${item.headline.length} 文字（推奨: 110以下）` });
        }

        if (type === 'FAQPage' && Array.isArray(item.mainEntity)) {
          item.mainEntity.forEach((q: any, i: number) => {
            if (!q.name) issues.push({ sev: 'error', msg: `FAQ[${i}] に name がありません` });
            if (!q.acceptedAnswer?.text) issues.push({ sev: 'error', msg: `FAQ[${i}] に acceptedAnswer.text がありません` });
          });
        }

        const errors   = issues.filter(i => i.sev === 'error').length;
        const warnings = issues.filter(i => i.sev === 'warning').length;
        const schemaScore = Math.max(0, 100 - errors * 20 - warnings * 5);

        schemas.push({ type, name: item.name ?? item.headline ?? '', issues, score: schemaScore });
      }
    } catch {
      schemas.push({ type: 'PARSE_ERROR', name: '', issues: [{ sev: 'error', msg: 'JSON-LDのパースに失敗しました' }], score: 0 });
    }
  }

  // Schema contribution to overall score (capped at 30)
  const sdScore = schemas.length === 0
    ? 0
    : Math.min(30, Math.round(schemas.reduce((s, sc) => s + sc.score, 0) / schemas.length * 0.3));

  // ── Topic cluster: heading structure + internal links ─────────
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => strip(m[1])).filter(Boolean);
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => strip(m[1])).filter(Boolean).slice(0, 8);
  const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m => strip(m[1])).filter(Boolean).slice(0, 8);

  const pageOrigin = new URL(url).origin;
  const genericWords = ['こちら', 'here', 'click', 'more', 'read', '詳しく', '続き', 'もっと'];
  let internalLinks = 0, genericAnchorCount = 0;
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1], anchor = strip(m[2]);
    if (href.startsWith('/') || href.startsWith(pageOrigin)) {
      internalLinks++;
      if (genericWords.some(g => anchor.toLowerCase().includes(g))) genericAnchorCount++;
    }
  }

  // Heading score (max 10)
  let headingScore = 0;
  if (h1s.length > 0)  headingScore += 3;
  if (h1s.length === 1) headingScore += 2;
  if (h2s.length >= 2)  headingScore += 3;
  if (h3s.length >= 2)  headingScore += 2;

  // Link score (max 10)
  let linkScore = 0;
  if (internalLinks >= 1) linkScore += 3;
  if (internalLinks >= 3) linkScore += 3;
  if (internalLinks >= 5) linkScore += 2;
  if (internalLinks > 0 && genericAnchorCount === 0) linkScore += 2;

  const topicScore = Math.min(20, headingScore + linkScore);

  const topicIssues: string[] = [];
  if (h1s.length === 0)  topicIssues.push('H1がありません');
  else if (h1s.length > 1) topicIssues.push(`H1が${h1s.length}個（1つが推奨）`);
  if (h2s.length < 2)    topicIssues.push('H2（サブトピック）が不足しています');
  if (internalLinks === 0) topicIssues.push('内部リンクがありません');

  return {
    metaTags: {
      score: metaScore,
      title: title.slice(0, 80),
      description: desc.slice(0, 130),
      hasOgp,
      message: `タイトル ${title ? '✓' : '✗'} / メタ説明 ${desc ? '✓' : '✗'} / OGP ${hasOgp ? '✓' : '✗'}`,
    },
    structuredData: {
      score: sdScore,
      schemasFound: schemas.length,
      schemas,
      message: schemas.length > 0
        ? `${schemas.length}件の構造化データを検出: ${[...new Set(schemas.map(s => s.type))].slice(0, 4).join(', ')}`
        : '構造化データ（JSON-LD）が見つかりません',
    },
    topicCluster: {
      score: topicScore,
      h1Count: h1s.length,
      h1Text: h1s[0] ?? '',
      h2Count: h2s.length,
      h2s,
      h3Count: h3s.length,
      internalLinks,
      message: topicIssues.length === 0
        ? `H1×${h1s.length} H2×${h2s.length} H3×${h3s.length} / 内部リンク ${internalLinks}件`
        : topicIssues.join(' / '),
    },
  };
}

// ── Types ─────────────────────────────────────────────────────────

interface SchemaEntry {
  type: string;
  name: string;
  issues: { sev: 'error' | 'warning'; msg: string }[];
  score: number;
}

// ── Email helpers ─────────────────────────────────────────────────

const CHECK_LABELS_EMAIL: Record<string, string> = {
  llmsTxt: 'llms.txt', robotsTxt: 'robots.txt', sitemapXml: 'sitemap.xml',
  metaTags: 'メタタグ', structuredData: '構造化データ', topicCluster: 'コンテンツ構造',
};
const MAX_SCORES_EMAIL: Record<string, number> = {
  llmsTxt: 40, robotsTxt: 20, sitemapXml: 10, structuredData: 30, metaTags: 10, topicCluster: 20,
};

function emailSymbol(key: string, c: any): { sym: string; color: string; scoreColor: string } {
  const G = { sym: '○', color: '#1a7a1a',  scoreColor: '#aaa' };
  const W = { sym: '△', color: '#8a6500',  scoreColor: '#8a6500' };
  const B = { sym: '×', color: '#b52020',  scoreColor: '#b52020' };
  switch (key) {
    case 'llmsTxt':    return !c.exists ? B : c.entryCount >= 5 ? G : W;
    case 'robotsTxt':  return !c.exists ? B : c.aiAllowed ? G : (c.blockedBots?.length ?? 0) < 4 ? W : B;
    case 'sitemapXml': return c.exists ? G : B;
    case 'metaTags': {
      const n = [c.title, c.description, c.hasOgp].filter(Boolean).length;
      return n === 3 ? G : n > 0 ? W : B;
    }
    case 'structuredData': {
      if (!c.schemasFound) return B;
      return (c.schemas ?? []).some((s: any) => s.issues?.some((i: any) => i.sev === 'error')) ? W : G;
    }
    case 'topicCluster': return c.score >= 16 ? G : c.score >= 8 ? W : B;
    default: return ('exists' in c ? c.exists : (c.schemasFound ?? c.score) > 0) ? G : B;
  }
}

// ── Handler ───────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { url, email } = await context.request.json() as { url?: string; email?: string };
    if (!url?.trim()) return errRes('URLを入力してください', 400);

    let target: URL;
    try { target = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`); }
    catch { return errRes('有効なURLを入力してください', 400); }

    const [robots, llms, sitemap, page] = await Promise.all([
      analyzeRobots(target.origin),
      analyzeLlms(target.origin),
      analyzeSitemap(target.origin),
      analyzePage(target.toString()),
    ]);

    const score = Math.min(100,
      robots.score + llms.score + sitemap.score + page.metaTags.score + page.structuredData.score + page.topicCluster.score
    );
    const gradeLabel = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';

    const result = {
      url: target.toString(),
      domain: target.hostname,
      score,
      grade: gradeLabel,
      checks: {
        llmsTxt:        llms,
        robotsTxt:      robots,
        sitemapXml:     sitemap,
        metaTags:       page.metaTags,
        structuredData: page.structuredData,
        topicCluster:   page.topicCluster,
      },
    };

    // ── Save to D1 (fire-and-forget) ─────────────────────────
    const id = crypto.randomUUID();
    context.env.brain_knowledge.prepare(
      `INSERT INTO diagnoses (id, url, domain, score, grade, result_json, email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      id,
      target.toString(),
      target.hostname,
      score,
      gradeLabel,
      JSON.stringify(result),
      email ?? null,
    ).run().catch(() => null);

    // ── Send email via GAS (only when email provided) ────────
    if (email && context.env.GAS_GMAIL_URL) {
      const checks = result.checks;
      const lines = [
        `LLMO 簡易診断レポート`,
        `対象URL: ${target.toString()}`,
        `診断日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
        ``,
        `総合スコア: ${score}/100 (${gradeLabel})`,
        ``,
        `【診断結果】`,
        ...(['llmsTxt','robotsTxt','sitemapXml','structuredData','metaTags','topicCluster'] as const).map(k => {
          const { sym } = emailSymbol(k, checks[k]);
          return `${sym} ${CHECK_LABELS_EMAIL[k]}: ${checks[k].message}`;
        }),
        ``,
        `【この診断について】`,
        `この診断は GPTBot・PerplexityBot などの AI クローラーと同じ手法で、`,
        `静的 HTML のみを解析しています。JavaScript で描画されるメタタグや構造化データは`,
        `AI にも認識されないため、このスコアに正直に反映されます。`,
        `スコアが低い場合、あなたのサイトは Google には見えていても、`,
        `AI には見えていない可能性があります。`,
        ``,
        `※ この診断はページ単位（単一ページ）の簡易診断です。`,
        `  詳細な改善提案・競合比較・全ページ分析は有料診断プランをご利用ください。`,
        `  https://effect.moe/contact`,
      ].join('\n');

      const html = `<div style="font-family:monospace;font-size:15px;color:#333;max-width:600px;margin:0 auto;padding:36px;">
  <p style="font-size:12px;letter-spacing:.1em;color:#999;text-transform:uppercase;margin-bottom:28px;">Effect AI — LLMO 簡易診断レポート</p>
  <p style="font-size:15px;margin-bottom:4px;">対象URL: <a href="${target.toString()}" style="color:#333;">${target.toString()}</a></p>
  <p style="font-size:13px;color:#aaa;margin-bottom:28px;">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
  <div style="font-size:36px;font-weight:bold;margin-bottom:4px;">${score}<span style="font-size:16px;font-weight:normal;color:#aaa;">/100</span> <span style="font-size:22px;">${gradeLabel}</span></div>
  <hr style="border:none;border-top:1px solid #eee;margin:18px 0 22px;">
  ${(['llmsTxt','robotsTxt','sitemapXml','structuredData','metaTags','topicCluster'] as const).map(k => {
    const c = checks[k];
    const { sym, color, scoreColor } = emailSymbol(k, c);
    const max = MAX_SCORES_EMAIL[k];
    const sc = c.score ?? 0;
    return `<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid #f0f0f0;">
      <span style="font-size:17px;color:${color};flex-shrink:0;min-width:22px;line-height:1.4;">${sym}</span>
      <div style="flex:1;">
        <div style="margin-bottom:4px;">
          <span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#999;">${CHECK_LABELS_EMAIL[k]}</span>
          <span style="font-size:12px;color:${scoreColor};margin-left:8px;">${sc}/${max}</span>
        </div>
        <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">${c.message}</p>
      </div>
    </div>`;
  }).join('')}
  <hr style="border:none;border-top:1px solid #eee;margin:22px 0;">
  <div style="border-left:2px solid #e8e8e8;padding-left:14px;margin-bottom:22px;">
    <p style="font-size:14px;color:#555;line-height:1.9;margin:0 0 8px;">この診断は GPTBot・PerplexityBot などの AI クローラーと同じ手法で、静的 HTML のみを解析しています。</p>
    <p style="font-size:14px;color:#777;line-height:1.9;margin:0;">JavaScript で描画されるメタタグや構造化データは AI にも認識されないため、このスコアに正直に反映されます。スコアが低い場合、あなたのサイトは Google には見えていても、<strong style="color:#444;">AI には見えていない可能性があります。</strong></p>
  </div>
  <p style="font-size:13px;color:#aaa;">※ この診断はページ単位（単一ページ）の簡易診断です。</p>
  <p style="font-size:13px;color:#aaa;margin-top:6px;">詳細な改善提案・競合比較・全ページ分析は <a href="https://effect.moe/contact" style="color:#555;">有料診断プラン</a> をご利用ください。</p>
  <p style="font-size:12px;color:#ccc;margin-top:28px;">effect.moe</p>
</div>`;

      await fetch(context.env.GAS_GMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_gmail',
          to: email,
          subject: `LLMO診断レポート: ${target.hostname}（${score}/100点）`,
          body: lines,
          html_body: html,
          from_name: 'EFFECT AI',
        }),
      }).catch(() => null);
    }

    return okRes(result);
  } catch (e: any) {
    return errRes(e.message ?? '診断に失敗しました');
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: cors() });

function okRes(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', ...cors() } });
}
function errRes(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', ...cors() } });
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
