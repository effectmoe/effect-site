# 02 — Information Architecture

> サイトのページ構造・URL 設計・ナビゲーション・遷移を固定するファイル。

---

## Site Map

```
/                              トップ（LP）
├── /posts/                    ナレッジ一覧（RAG コーパスの可視化）
│   └── /posts/[slug]          個別記事
├── /diagnose/                 簡易 LLM 診断（多段フォーム）
│   └── /diagnose/result/[id]  診断結果ページ
├── /cases/                    クライアント実績一覧
│   └── /cases/[slug]          個別事例
├── /about/                    会社・理念・チーム
├── /contact/                  問い合わせフォーム
├── /llms.txt                  LLM 向け sitemap（既に実装あり）
├── /robots.txt                クローラー制御（既に実装あり）
├── /sitemap.xml               検索エンジン向け sitemap
├── /rss.xml                   RSS フィード
└── /[legals]                  プライバシー / 利用規約 / 特商法
```

## 旧 URL からの移行

```
/articles/[slug]  → /posts/[slug]        301 redirect
/blog/[slug]      → /posts/[slug]        301 redirect
/knowledge/[slug] → /posts/[slug]        301 redirect
/works/[slug]     → /cases/[slug]        301 redirect
```

リダイレクトは Cloudflare Pages の `_redirects` または `functions/_middleware.js` で実装。

## Top Page Section Order

LP 型の物語フロー。上から下へ訪問者の納得を積み上げる:

| # | セクション | 目的 | 既存コンポーネント |
|---|---|---|---|
| 1 | **Hero (Globe + Chat)** | 体験の入口 | `GlobeHeroSplit.astro` |
| 2 | **LLMO 診断 CTA** | サブ CV | `LlmoDiagnosisWidget.astro` |
| 3 | **Latest Knowledge** | 知見の蓄積を見せる | `KnowledgeHome.astro` |
| 4 | **About** | なぜ effect.moe か | `AboutHome.astro` |
| 5 | **Services** | 何ができるか | `Services.astro` |
| 6 | **Process** | どう進めるか | `Process.astro` |
| 7 | **Cases** | 実績の証明 | `WorksHome.astro` |
| 8 | **Testimonials** | 第三者評価 | `Testimonials.astro` |
| 9 | **Contact CTA** | 最終 CV | フッター上の CTA |

各セクションは独立したコンポーネントとして既に存在。並び順とコピー、視覚的階層を最適化する。

## Navigation

### Global Header
- Logo (effect.moe) → /
- Posts → /posts
- Cases → /cases
- Diagnose → /diagnose（強調表示）
- About → /about
- Contact → /contact（CTAボタン化）

### Global Footer
- サイトマップ的なリンク群
- SNS（GitHub / X など）
- 特商法 / プライバシー / 利用規約
- Copyright

## URL 設計ルール

- すべて小文字、kebab-case
- 日付は URL に含めない（permanent URL）
- カテゴリは URL に含めない（記事の所属が変わっても URL が変わらない）
- 例: `/posts/llm-rag-internal-knowledge`

## ナビゲーション原則

- どのページからもトップに 1 クリックで戻れる
- どのページからも `/diagnose` に 1 クリックで行ける
- どの記事からも関連記事 3 件が見える（同じ category または tags のもの）
- 検索は Pagefind を採用（クライアントサイド、ビルド時生成）

## Routing 実装メモ

- Astro の `src/pages/posts/[slug].astro` で動的ルート
- `getStaticPaths` で content collection を全件展開（prerender）
- 個別記事から関連記事へのリンクは frontmatter の `category` と `tags` を使って同種記事を抽出
