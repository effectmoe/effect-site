# effect-site (effect.moe)

LLMO/DXに特化したメディアサイト。OpenClawを中核エージェントとしたプロジェクト。

## 技術スタック

- React Router 7 (v7.12) + Cloudflare Workers
- Tailwind CSS v4 + Vite 7
- TypeScript strict
- Notion REST API（ヘッドレスCMS）
- D1（SQLite）、KV（キャッシュ）、Workers AI（埋め込み）

## デプロイ

**アカウント**: agent.monchan@gmail.com（OpenClaw専用）
**URL**: https://effect-site.openclaw-agent.workers.dev
**VM**: OpenClaw-VM（Parallels、IP: 10.211.55.7、user: monchan）

### デプロイ手順（重要）

`npm run deploy` はVM上では動作しない（virtual:react-router/server-build が解決できない）。
必ず以下の手順で行うこと:

```bash
# 1. ローカルでビルド
cd ~/projects/effect-site
npm run build

# 2. VMに同期（.wrangler は除外）
rsync -avz --delete \
  --exclude node_modules --exclude .git --exclude .wrangler \
  ~/projects/effect-site/ \
  monchan@10.211.55.7:~/projects/effect-site/

# 3. VM上でビルド済みwrangler.jsonを使ってデプロイ
ssh monchan@10.211.55.7 'export PATH="/Users/monchan/.nvm/versions/node/v22.22.0/bin:$PATH" && cd ~/projects/effect-site/build/server && npx wrangler deploy --config wrangler.json'
```

### シークレット設定

```bash
ssh monchan@10.211.55.7 'export PATH="/Users/monchan/.nvm/versions/node/v22.22.0/bin:$PATH" && cd ~/projects/effect-site && echo "VALUE" | npx wrangler secret put SECRET_NAME'
```

設定済みシークレット: NOTION_API_KEY, ADMIN_API_KEY

## リソース

| バインディング | タイプ | ID |
|---|---|---|
| DB | D1 | dda0c5b6-c508-492a-8b9c-f85efc3e0fd4 |
| CACHE | KV | 28ffe2354a8d43158592b036e22aa49a |
| AI | Workers AI | - |

## Notion

- 記事DB: `304b802cb0c68148bb0cf1afaf06ff7d`
- API: REST fetch（@notionhq/client はpackage.jsonにあるが未使用）
- 実装: `app/lib/notion.server.ts`

## アーキテクチャ

```
Cloudflare Edge (Workers)
  ├─ SSR (React Router 7)
  ├─ AI Crawler Detection → D1 ログ
  ├─ KV Cache (5min TTL)
  └─ Cron: */5 キャッシュウォーム
         ↓
OpenClaw Gateway VM (:18789)
         ↓
Ollama (Mac Studio GPU)
```

## ルート構成

| パス | ファイル | 種別 |
|---|---|---|
| / | _index.tsx | ページ |
| /articles | articles._index.tsx | ページ |
| /articles/:slug | articles.$slug.tsx | ページ |
| /about | about.tsx | ページ |
| /llms.txt | llms[.]txt.ts | SEO |
| /robots.txt | robots[.]txt.ts | SEO |
| /sitemap.xml | sitemap[.]xml.ts | SEO |
| /api/chat | api.chat.ts | API |
| /api/crawler-stats | api.crawler-stats.ts | API |
| /api/analytics | api.analytics.ts | API |
| /api/index-articles | api.index-articles.ts | API |
| /api/patrol-results | api.patrol-results.ts | API |

## サーバーライブラリ

| ファイル | 役割 |
|---|---|
| notion.server.ts | Notion REST APIクライアント（fetch直接使用） |
| cache.server.ts | KVキャッシュ（stale-while-revalidate） |
| ai-crawler.server.ts | AIクローラー検出（20+パターン） |
| auth.server.ts | Bearer/X-API-Key認証 |
| jsonld.ts | JSON-LD構造化データ（@graph形式） |
| llms-txt.server.ts | llms.txt生成 |
| middleware.server.ts | リクエストミドルウェア |

## D1マイグレーション

5つ適用済み: crawler_logs, faq_cache, patrol_results, analytics, article_chunks

## LLMO原則

- AIクローラーと人間に同一HTMLを提供（クローキング禁止）
- JSON-LD、llms.txt、robots.txt で構造化情報を付加
- X-AI-Context レスポンスヘッダーでメタ情報提供

## コミットルール

- ASCII-only（日本語・絵文字禁止）
- conventional commits: feat:, fix:, chore:, docs:
