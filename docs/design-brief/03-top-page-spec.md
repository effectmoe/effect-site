# 03 — Top Page Specification

> トップページ `/`（`src/pages/index.astro`）の詳細仕様。
> Claude Code はこの仕様に従って実装する。

---

## 全体方針

- **ファーストビューに体験を置く**: チャット入力欄が訪問者の最初の選択肢
- **物語として下に積み上げる**: 体験 → 知見 → 信頼 → 行動
- **すべてのセクションは独立コンポーネント**: 順序変更が容易

## Hero — Globe + Chat Split（最重要）

### 視覚仕様
- **左半分**: チャット入力 + LLMO 診断 CTA + 見出しコピー + 説明 + 主 CTA ボタン
- **右半分**: ドットマトリクス地球（既存 `globe.ts` をそのまま使用）
  - 文字 `· . + # @` で構成された等幅文字グリッド
  - 自動回転（rotSpeed 制御）
  - 経度表示（`LON 000.0°` を右下にモノスペース）
- モバイル: 縦並び（地球が上、コンテンツが下）
- 既存実装: `src/components/sections/home/hero/GlobeHeroSplit.astro` を維持

### インタラクション
- 入場アニメ: GSAP timeline（globe フェードイン → marquee → h1 → description → button → 座標）
- チャット開始時: `chat:started` イベント → 地球が消えてチャットが全画面化
- チャットリセット時: `chat:reset` イベント → 地球が戻る
- IntersectionObserver で画面外なら描画停止（パフォーマンス）

### コピー（既存 i18n キーを参照）
- `index.hero.marqueetext` — マーキー
- `index.hero.h1` — 主見出し
- `index.hero.description` — 説明文
- `index.hero.btn` — CTA ラベル

## Section 2 — LLMO 診断 CTA

- 既存 `LlmoDiagnosisWidget.astro` を維持
- Hero の左カラム内に同居
- 「30 秒で AI 活用度を診断する →」型の強い CTA

## Section 3 — Latest Knowledge（記事一覧）

### 仕様
- 最新 4 件を表示（`KNOWLEDGE_COUNT` 定数で制御）
- カード型レイアウト（grid: モバイル 1col / タブレット 2col / デスクトップ 4col）
- 各カードに表示する要素:
  - 等幅フォントの日付（YYYY.MM.DD）
  - カテゴリ（モノスペース、`[CATEGORY]` 風表現）
  - タイトル
  - 説明（最大 2 行）
- 「すべての記事を見る →」リンクで `/posts` へ

### データソース
- `src/content/posts/` 全体（マイグレーション後）
- `data.draft !== true` のものだけ
- `data.date` で降順ソート

## Section 4 — About

- 既存 `AboutHome.astro` を維持
- 「なぜ effect.moe を選ぶか」の要素3〜4点
- 数値で語れる箇所は数値で（例: 「○件の AI 導入支援実績」）

## Section 5 — Services

- 既存 `Services.astro` を維持
- 提供サービスを3〜4種類グリッド表示
- 各サービスから詳細ページへリンク（将来的に `/services/[slug]`）

## Section 6 — Process

- 既存 `Process.astro` を維持
- 「ヒアリング → 診断 → 実装 → 運用」の流れを段階表示

## Section 7 — Cases / Works

- 既存 `WorksHome.astro` を維持
- featured な事例 3 件を抽出
- 各事例カードに数値成果を 1 行で（例: 「問い合わせ対応 60% 自動化」）

## Section 8 — Testimonials

- 既存 `Testimonials.astro` を維持
- 顧客の声を 2〜3 件
- 装飾は控えめ、署名と肩書を明記

## Section 9 — Contact CTA（フッター直前）

- 「課題があれば、まず話を聞かせてください」型の強い CTA
- メール / フォームへの動線
- セクション全体を等幅フォントで意匠化（"$ contact --your-question"風）

---

## レイアウト・余白

- 各セクションの上下 padding はデスクトップで `py-24`、モバイルで `py-12`
- 横方向の最大幅は `max-w-7xl mx-auto`
- セクション間の区切り線は使わない（タイポと余白で区切る）

## 構造化データ要件

トップページに以下の JSON-LD を埋め込む:

```jsonld
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "name": "effect.moe", ... },
    { "@type": "WebSite", "url": "https://effect.moe", "potentialAction": { "@type": "SearchAction", ... } }
  ]
}
```

各記事ページには `Article` + `BreadcrumbList`、診断ページには `WebApplication` を入れる。

## アクセシビリティ要件

- すべてのインタラクティブ要素に `aria-label`
- Globe canvas は `aria-hidden="true"` + 隣接要素に説明テキスト
- チャット入力は `<label>` 必須
- カラーコントラスト WCAG AA 準拠（4.5:1 以上）

## パフォーマンス目標

- LCP < 2.5s
- CLS < 0.1
- INP < 200ms
- Lighthouse Performance 90+
- バンドルサイズ: トップで 200KB（gzipped）以下を目標

Globe canvas は遅延描画 + IntersectionObserver で抑制。GSAP は必要な箇所のみ import。
