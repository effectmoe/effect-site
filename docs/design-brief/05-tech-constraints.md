# 05 — Technical Constraints

> 実装上の制約・前提・既存資産・パフォーマンス目標を固定するファイル。
> Claude Code はこれを守って実装すること。

---

## Tech Stack（変更不可）

- **Astro 6.x** — フレームワーク
- **Cloudflare Pages** — ホスティング
- **@astrojs/cloudflare 13.x** — adapter
- **Tailwind CSS 4.x** — スタイリング
- **MDX** — リッチコンテンツ
- **TypeScript** — 型付け
- **pnpm** — パッケージマネージャ
- **Cloudflare Pages Functions** — サーバーサイド API（`functions/api/*.ts`）

## 既存の動的 API（変更不可・再利用必須）

```
functions/api/
├── chat.ts                 ヒーローのチャット
├── article-chat.ts         記事ごとの追問チャット
├── diagnose-llmo.ts        LLMO 簡易診断
├── save-conversation.ts    会話ログ保存
├── search.js               RAG 検索
├── articles.js             記事一覧API
├── crawler-stats.js        AI クローラー統計
├── contact.js              問い合わせフォーム
├── log.js                  ロギング
├── llms.txt.js             /llms.txt 生成
└── robots.txt.js           /robots.txt 生成
```

これらの API は **既に動作している**。再設計時は呼び出しインターフェースを維持する。

## 既存の動的依存

- **@upstash/redis** — Redis 接続（会話ログ等）
- **resend** — 問い合わせメール送信
- **sharp** — 画像処理
- **gsap** — アニメーション（Hero のみ）
- **lenis** — スムーズスクロール（**再評価対象、削除候補**）
- **astro-icon** — SVG アイコン

## 既存資産（保持・拡張）

### 1. Globe アニメーション
- `src/components/sections/home/hero/globe.ts`
- `src/components/sections/home/hero/GlobeHeroSplit.astro`
- **絶対に削除しない**。これがサイトの DNA。
- パフォーマンス問題があれば最適化（描画間引き、IntersectionObserver）で対応

### 2. Chat / Diagnosis Widget
- `src/components/sections/home/hero/AiChatWidget.astro`
- `src/components/sections/home/hero/LlmoDiagnosisWidget.astro`
- 機能はそのまま、見た目はデザインブリーフに沿って調整可

### 3. i18n 機構
- `src/lib/utils.ts` の `t()` 関数
- すべてのテキストは i18n キー経由で出す

## 削減・整理する依存

| 依存 | 判断 |
|---|---|
| lenis | **削除候補**。スムーズスクロールは AI クローラーには無意味、UX への寄与も限定的 |
| 過剰な GSAP timeline | Hero 以外では使わない。記事一覧などのエントランスは CSS transform で十分 |

## ディレクトリ構成（目標）

```
src/
├── assets/                       静的アセット
├── components/
│   ├── common/                   共通部品（BaseHead, MarqueeText 等）
│   ├── sections/
│   │   ├── home/                 トップページ用セクション
│   │   ├── post/                 記事ページ用セクション（旧: blog/article 統合）
│   │   ├── case/                 事例ページ用セクション（旧: works）
│   │   └── thino/                Thino 表示用セクション【新規】
│   └── ui/                       ボタン・カード等の汎用 UI
├── content/
│   ├── posts/                    すべての記事（旧: articles + blogs + knowledge を統合）
│   ├── thinos/                   Thino 投稿（daily 単位）【新規】
│   ├── cases/                    クライアント事例（旧: projects）
│   └── legals/                   法的ページ
├── content.config.ts             collection 定義
├── layouts/                      レイアウト
├── lib/                          utilities
├── pages/
│   ├── index.astro               トップ
│   ├── posts/
│   │   ├── index.astro           記事一覧
│   │   └── [slug].astro          個別記事
│   ├── cases/
│   ├── thinos/
│   │   └── index.astro           Thino タイムライン全体【新規】
│   ├── diagnose/
│   ├── about.astro
│   ├── contact.astro
│   └── [legals].astro
├── styles/                       グローバルCSS
└── effect-web/                   ← 廃止予定（content/ に統合）
```

## 旧 URL → 新 URL のリダイレクト

`public/_redirects` で実装（Cloudflare Pages 標準）:

```
/articles/*    /posts/:splat    301
/blog/*        /posts/:splat    301
/knowledge/*   /posts/:splat    301
/works/*       /cases/:splat    301
```

## パフォーマンス目標（必達）

| 指標 | 目標 |
|---|---|
| Lighthouse Performance | 90+ |
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| バンドル（トップ） | gzip 200KB 以下 |
| Globe 描画 | 60fps 維持、画面外で停止 |
| 画像 | Astro `<Image>` で WebP/AVIF 自動変換 |

## SEO / LLMO 必達要件

### 構造化データ（必須）
- トップ: `Organization` + `WebSite` + `SearchAction`
- 記事: `Article` + `BreadcrumbList` + `Author`
- 事例: `CreativeWork` + `BreadcrumbList`
- 診断: `WebApplication`

### メタタグ（必須）
- title / description / keywords（既存 i18n キー使用）
- canonical
- OGP（og:title / og:description / og:image / og:type）
- Twitter Card（summary_large_image）
- favicon / apple-touch-icon

### Sitemap / Robots / llms.txt
- `sitemap.xml`: `@astrojs/sitemap` で自動生成
- `robots.txt`: `functions/robots.txt.js` でクローラー制御
- `llms.txt`: `functions/llms.txt.js` で LLM 向けマップ提供（既存）

## アクセシビリティ要件（WCAG 2.1 AA）

- カラーコントラスト 4.5:1 以上
- すべてのインタラクティブ要素に `aria-label`
- フォーカスリングを明示（`focus-visible:ring-2`）
- キーボードのみで全機能操作可能
- `prefers-reduced-motion` を尊重（GSAP を抑制）

## CSP / セキュリティ

- Inline script は最小限
- 外部リソース読み込みは限定（フォント、画像 CDN）
- `functions/_middleware.js` で CSP ヘッダ付与
- Cloudflare Pages の env で秘密鍵管理（GitHub Secrets 経由）

## 開発・デプロイフロー

```
ローカル開発:
  pnpm dev                       → astro dev
  pnpm preview                   → built preview
  
ビルド:
  pnpm build                     → astro build (output: dist/)
  
デプロイ:
  pnpm deploy                    → wrangler pages deploy dist
  pnpm deploy:preview            → preview ブランチへ
```

## NG パターン（やってはいけないこと）

1. **既存の `functions/api/*` のインターフェースを破壊**
2. **Globe を削除・大幅変更**
3. **記事を新フォルダに散らす**（必ず `posts/` に統合）
4. **重い依存追加**（Three.js / Framer Motion / React 等は不要）
5. **Tailwind から CSS-in-JS への移行**
6. **inline で大きな data: URL を埋め込む**
7. **クライアントサイドルーティング** — Astro 標準のページ遷移を尊重
8. **JS なしで動かないコンテンツを作る** — 記事本文は HTML だけで読めること
