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

  let score = 28;
  if (entries.length >= 5) score += 8;
  else if (entries.length > 0) score += 4;
  if (size > 300) score += 4;

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
  };
}

// ── Types ─────────────────────────────────────────────────────────

interface SchemaEntry {
  type: string;
  name: string;
  issues: { sev: 'error' | 'warning'; msg: string }[];
  score: number;
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
      robots.score + llms.score + sitemap.score + page.metaTags.score + page.structuredData.score
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
        `llms.txt: ${checks.llmsTxt.message}`,
        `robots.txt: ${checks.robotsTxt.message}`,
        `sitemap.xml: ${checks.sitemapXml.message}`,
        `メタタグ: ${checks.metaTags.message}`,
        `構造化データ: ${checks.structuredData.message}`,
        ``,
        `※ この診断はページ単位（単一ページ）の簡易診断です。`,
        `  詳細な改善提案・競合比較・全ページ分析は有料診断プランをご利用ください。`,
        `  https://effect.moe/contact`,
      ].join('\n');

      const html = `<div style="font-family:monospace;font-size:13px;color:#333;max-width:600px;margin:0 auto;padding:32px;">
  <p style="font-size:10px;letter-spacing:.1em;color:#999;text-transform:uppercase;margin-bottom:24px;">Effect AI — LLMO 簡易診断レポート</p>
  <p style="margin-bottom:4px;">対象URL: <a href="${target.toString()}" style="color:#333;">${target.toString()}</a></p>
  <p style="font-size:11px;color:#aaa;margin-bottom:24px;">${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
  <div style="font-size:32px;font-weight:bold;margin-bottom:4px;">${score}<span style="font-size:14px;font-weight:normal;color:#aaa;">/100</span> <span style="font-size:20px;">${gradeLabel}</span></div>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0 20px;">
  ${Object.entries(checks).map(([, c]: [string, any]) =>
    `<p style="margin-bottom:8px;line-height:1.6;">${c.message}</p>`
  ).join('')}
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
  <p style="font-size:11px;color:#aaa;">※ この診断はページ単位（単一ページ）の簡易診断です。</p>
  <p style="font-size:11px;color:#aaa;margin-top:4px;">詳細な改善提案・競合比較・全ページ分析は <a href="https://effect.moe/contact" style="color:#666;">有料診断プラン</a> をご利用ください。</p>
  <p style="font-size:10px;color:#bbb;margin-top:24px;">effect.moe</p>
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
