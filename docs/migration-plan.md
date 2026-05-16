# Content Migration Plan

> 旧 `src/effect-web/{articles,blogs,knowledge,projects,legals}` を、
> 新 `src/content/{posts,thinos,cases,legals}` に一元化する手順。

---

## 重要な発見（先に確認）

`src/content.config.ts` の `base` は `./src/content/<name>` を指しているが、
実ファイルは `src/effect-web/<name>` に存在する。

つまり現状:
- 設定とファイル位置が **乖離している**
- collection は実質空のまま動いている可能性が高い
- 既存 index.astro の `getCollection('articles')` などは0件返している恐れ

この migration はその不整合の解消も兼ねる。

## 現状の棚卸し

```
src/effect-web/
├── articles/    4 files   (.md)
├── blogs/       3 files   (.md)
├── knowledge/   1 file    (.md)
├── projects/    5 files   (.mdx)
├── legals/      3 files   (.md)
└── .obsidian/   個人設定（gitignored、既に処理済）

合計 16 コンテンツファイル → 移行は軽量
```

## 移行先の目標構造

```
src/content/
├── posts/       articles + blogs + knowledge の 8 ファイルを統合
├── thinos/      新設、日次ファイル
├── cases/       projects から名称変更（5 ファイル）
└── legals/      そのまま（3 ファイル）
```

## Phase 1: 新ディレクトリ作成と collection 定義

### 1-1. `src/content/` を新規作成

```bash
mkdir -p src/content/{posts,thinos,cases,legals}
```

### 1-2. `src/content.config.ts` を新スキーマで上書き

```typescript
import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

// === posts: articles + blogs + knowledge を統合 ===
const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.{md,mdx}'
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),

    // 分類
    type: z.enum(['post', 'pillar', 'case-note']).default('post'),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    audience: z.array(z.string()).default([]),

    // RAG 制御
    rag_indexed: z.boolean().default(true),
    rag_priority: z.number().int().min(1).max(3).default(2),

    // ソース情報（着想型記事）
    source: z.object({
      type: z.enum(['original', 'voice-reaction', 'ai-assisted']).default('original'),
      inspired_by: z.array(z.object({
        url: z.string().url(),
        author: z.string(),
        title: z.string().optional(),
        accessed: z.coerce.date(),
      })).optional(),
      voice_memo: z.string().optional(),
      transcript: z.string().optional(),
      seed_thino: z.string().optional(),
    }).optional(),

    // 編集状態
    human_final_edit: z.boolean().default(false),
    reviewer: z.string().optional(),
    review_date: z.coerce.date().optional(),

    // 公開メタ
    heroImage: z.union([z.string(), image()]).optional(),
    featured: z.boolean().default(false),

    // 互換性（旧 articles/knowledge 由来）
    domain: z.string().optional(),
    sources: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
  }),
});

// === thinos: つぶやき、日次ファイル ===
const thinos = defineCollection({
  loader: glob({
    base: './src/content/thinos',
    pattern: '*.md'
  }),
  schema: z.object({
    date: z.coerce.date(),
  }),
});

// === cases: クライアント実績（旧 projects） ===
const cases = defineCollection({
  loader: glob({
    base: './src/content/cases',
    pattern: '**/*.{md,mdx}'
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    coverImage: image(),
    tags: z.array(z.string()),
    clientLink: z.string().url().optional(),
    date: z.coerce.date(),
    client: z.string().optional(),
    featured: z.boolean().default(false),
    icon: z.string().optional(),
    metrics: z.array(z.string()).default([]),
  }),
});

// === legals: 法的ページ ===
const legals = defineCollection({
  loader: glob({
    base: './src/content/legals',
    pattern: '**/*.{md,mdx}'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { posts, thinos, cases, legals };
```

## Phase 2: 既存ファイルの移動と frontmatter 変換

### 2-1. ファイル移動

```bash
# git history を保持するため git mv を使う

# articles → posts
git mv src/effect-web/articles/*.md src/content/posts/

# blogs → posts（frontmatter 互換性に注意）
git mv src/effect-web/blogs/*.md src/content/posts/

# knowledge → posts
git mv src/effect-web/knowledge/*.md src/content/posts/

# projects → cases
git mv src/effect-web/projects/*.mdx src/content/cases/

# legals はそのまま
git mv src/effect-web/legals/*.md src/content/legals/
```

### 2-2. frontmatter 統一スクリプト

`scripts/migrate-frontmatter.ts` を作成し、以下を変換:

#### blogs 由来のフィールド変換

旧（blogs）:
```yaml
title: ...
description: ...
heroImage: ./hero.webp
topics: [a, b, c]
pubDate: 2026-04-01
author: tonychu
readingTime: "5 min"
featured: true
```

新:
```yaml
title: ...
description: ...
date: 2026-04-01            # pubDate → date
tags: [a, b, c]             # topics → tags
heroImage: ./hero.webp
featured: true
type: post
rag_indexed: true
# author, readingTime は削除（必要なら別管理）
```

#### articles 由来のフィールド変換

ほぼそのまま使えるが、追加:
```yaml
type: post
rag_indexed: true
human_final_edit: true
source:
  type: original          # 既存記事はすべて original 扱い
```

#### knowledge 由来のフィールド変換

ほぼそのまま使えるが、追加:
```yaml
type: post
rag_indexed: true
rag_priority: 1           # knowledge は高優先度に
```

### 2-3. アセット参照の更新

`heroImage: ./hero.webp` のように相対参照しているファイルは、
移動後もパスを修正する必要がある場合がある。
画像は記事と同じディレクトリに同居させるルール:

```
src/content/posts/
├── 2026-04-28-forbes-homepage-ai.md
├── 2026-04-28-forbes-homepage-ai/
│   └── hero.webp
```

## Phase 3: ルーティングの更新

### 3-1. 新ルーティング

```
src/pages/
├── index.astro                  トップ
├── posts/
│   ├── index.astro              一覧ページ（旧 articles/blog/knowledge を統合）
│   └── [slug].astro             個別記事
├── cases/
│   ├── index.astro              旧 works を改名
│   └── [slug].astro
├── thinos/
│   └── index.astro              タイムライン【新規】
├── diagnose/                    旧 admin 配下から移設も検討
└── ...
```

### 3-2. index.astro の修正

```typescript
// 旧
const knowledge = await getCollection('knowledge', ({ data }) => !data.draft);
const articles = await getCollection('articles', ({ data }) => !data.draft);

// 新
const posts = await getCollection('posts', ({ data }) => !data.draft);
```

### 3-3. 削除するページ

```
src/pages/articles/   削除（/posts に統合）
src/pages/blog/       削除
src/pages/knowledge/  削除
src/pages/works/      → cases/ に改名
```

## Phase 4: リダイレクト設定

`public/_redirects` を新規作成（Cloudflare Pages 標準）:

```
/articles/*    /posts/:splat    301
/article/*     /posts/:splat    301
/blog/*        /posts/:splat    301
/blogs/*       /posts/:splat    301
/knowledge/*   /posts/:splat    301
/works/*       /cases/:splat    301
/work/*        /cases/:splat    301
```

検証:
```bash
curl -I https://effect.moe/articles/some-post
# → 301 Location: /posts/some-post
```

## Phase 5: 動作確認

### 5-1. ローカル
```bash
pnpm dev
# /                       トップ確認
# /posts                  記事一覧
# /posts/[slug]           個別記事 × 8 件
# /cases                  事例一覧
# /cases/[slug]           個別事例 × 5 件
# /thinos                 空表示 OK（Thino 投入は別フェーズ）
```

### 5-2. ビルド
```bash
pnpm build
# エラーなく完了すること
# dist/ にすべての記事HTMLが生成されること
```

### 5-3. Lighthouse
- LCP / CLS / INP を計測
- 移行前後でスコア劣化していないこと

## Phase 6: 旧フォルダの削除

すべての検証完了後:

```bash
git rm -r src/effect-web
git commit -m "remove legacy effect-web directory after content migration"
```

## ロールバック手順

何か問題があった場合:

```bash
git revert <migration-commit-sha>
# または
git checkout master -- src/effect-web src/content.config.ts
```

`public/_redirects` は影響軽微なので、戻す場合はファイル削除のみ。

## 既存記事リスト（移行対象）

```
articles/
  2026-04-27-llmo-llm最適化-とは何か-定義-手法-および重要性.md
  2026-05-01-commandc-pwa-の-claude_cli-モードとは-仕組みと活用方法.md
  2026-05-05-競合-官公庁の更新を見逃さない情報インフラ-経営者のための-urlwatch-llm-要約-運用設計.md
  2026-05-06-ai-開発ツール移行の-見えないコスト-設定再設計が投資対効果を左右する理由.md

blogs/
  websites-that-convert.md
  smarter-ai-workflows.md
  startup-automation-leverage.md

knowledge/
  2026-04-28-forbes-homepage-ai.md

projects/
  cipres-energy.mdx
  olmo-studio.mdx
  cipres-agency.mdx
  larch-agency.mdx
  banyan-studio.mdx

legals/
  licensing.md
  privacy-policy.md
  terms-of-service.md
```

## 移行の所要時間見積もり

| Phase | 内容 | 時間 |
|---|---|---|
| 1 | ディレクトリと collection 定義 | 30 分 |
| 2 | ファイル移動と frontmatter 変換 | 1〜2 時間 |
| 3 | ルーティング更新 | 1 時間 |
| 4 | リダイレクト設定 | 15 分 |
| 5 | 動作確認 | 30 分 |
| 6 | 旧フォルダ削除 | 5 分 |
| **計** | | **約 4 時間** |

軽量ファイル数なので一気にやれる。
