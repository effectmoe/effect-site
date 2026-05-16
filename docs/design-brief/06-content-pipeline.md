# 06 — Content Pipeline

> コンテンツがどう生成され、公開され、RAG に流れるかを定義するファイル。
> このパイプラインそのものが effect.moe の競争優位の源泉。

---

## コンテンツの3層構造

```
┌─────────────────────────────────────────────┐
│ Tier 1: Thino（つぶやき・30 秒キャプチャ）  │
│  → 思考の現場のライブ                       │
│  → /thinos に表示、トップにも抜粋           │
└─────────────────────────────────────────────┘
              ↓ 育てる
┌─────────────────────────────────────────────┐
│ Tier 2: Post（音声反応 + AI 統合の記事）    │
│  → RAG コーパスの本体                       │
│  → /posts/[slug] に格納                     │
└─────────────────────────────────────────────┘
              ↓ 体系化
┌─────────────────────────────────────────────┐
│ Tier 3: Pillar（長尺・権威記事）            │
│  → 検索/LLMO 主戦場                         │
│  → /posts/[slug]、frontmatter で pillar 指定 │
└─────────────────────────────────────────────┘
```

## Tier 1 — Thino（つぶやき）

### キャプチャ
- Obsidian + Thino plugin で 30 秒以内にキャプチャ
- 保存先: `src/content/thinos/YYYY-MM-DD.md`
- 1 日 1 ファイルに append される
- モバイルでも可（Obsidian モバイル + Thino）

### Frontmatter / 構造
```markdown
---
date: 2026-05-16
---

## 17:42  #public #ai-vision-laundering #seed
平野氏のビジョンロンダリング論を読んだ。Claude Code 使う側として痛い指摘。
ただ、ガードレール設計があれば回避できる構造のはず。

source: https://facebook.com/share/p/...
voice_memo: ./voice/2026-05-16-1742.m4a

---

## 19:13  #public #thoughts
RAG の精度はコーパスの質 > 量。これ何度でも言う。
```

### タグ規約
| タグ | 意味 |
|---|---|
| `#public` | サイトに公開する（**必須・オプトイン**） |
| `#seed` | 記事化候補 |
| `#to-voice` | 音声反応を録る予定 |
| `#to-article` | 記事化フローに進める |
| `#thoughts` | 単独完結のつぶやき |
| `#client-insights` | クライアント関連（公開時は匿名化必須） |
| `#ai-news` | AI 業界トピック |
| `#article-update` | 既存記事の改訂ネタ |

`#public` がないものはサイトに出さない。デフォルト非公開を徹底。

### サイトへの露出
- トップページ: 最新 5 件（`#public` のみ）
- `/thinos` ページ: 全期間タイムライン（`#public` のみ）
- 関連 Thino が記事になったら、その Thino から記事へリンクを追加

## Tier 2 — Post（音声反応 + AI 統合の記事）

### 生成フロー（標準）

```
[1] Thino キャプチャ
       ↓
[2] 音声反応を録る（30 秒〜10 分）
    端末: iPhone 音声メモ / Mac Studio で Whisper
    内容の最小構造:
      - この記事の何に反応したか
      - 同意する点と理由
      - 違和感を持った点と理由
      - effect.moe での関連経験
      - 自分なら違う言い方をする箇所
       ↓
[3] Whisper (large-v3) で文字起こし
    実行: mac-studio で常時稼働
    出力: 音声 + transcript を /posts/[slug].assets/ に保存
       ↓
[4] Command-C PWA で統合
    入力:
      - 音声トランスクリプト（記事の骨格）
      - Thino テキスト
      - 着想元 SNS 投稿
      - effect.moe ナレッジ（RAG 検索）
    指示:
      - ユーザー発言にない事実は補完しない
      - 引用倫理ガイドラインを守る
      - 主従関係：自分の見解が主、引用が従
       ↓
[5] ドラフト生成
    src/content/posts/draft/[slug].md に保存
       ↓
[6] 人間レビュー（必須）
    チェック項目:
      - 元発信者へのリスペクトが保たれているか
      - 引用が短く、出典明示があるか
      - 独自視点が明確か
      - AI 補完された箇所がないか
      - 自社事例・数値が含まれているか
       ↓
[7] frontmatter 整備 + 公開
    /posts/[slug].md に移動
```

### Frontmatter スキーマ

```yaml
---
title: ビジョンロンダリングを設計で回避する
description: 平野友康氏の指摘を受けて、Claude Code 実装で気をつけている 3 つのガードレール
date: 2026-05-20
updated: 2026-05-22
draft: false

# 分類
type: post                    # post / pillar / case-note
category: ai-engineering      # 主カテゴリ
tags: [claude-code, governance, ai-ethics]
audience: [practitioner, decision-maker]

# RAG 制御
rag_indexed: true
rag_priority: 1               # 1 (高) - 3 (低)

# ソース情報（着想型記事の場合）
source:
  type: voice-reaction        # original / voice-reaction / ai-assisted
  inspired_by:
    - url: https://facebook.com/share/p/18Uj1bDnYS/
      author: 平野友康
      title: ビジョンロンダリング論
      accessed: 2026-05-16
  voice_memo: ./voice-memo.m4a
  transcript: ./voice-memo-transcript.md
  seed_thino: 2026-05-16T17:42

# 編集状態
human_final_edit: true
reviewer: tonychu
review_date: 2026-05-19

# 公開メタ
heroImage: ./hero.webp
featured: false
---
```

### ガードレール（必須）

| ルール | 詳細 |
|---|---|
| ユーザー発言にない事実を AI が補完しない | プロンプトに明記、出力時に検出 |
| 引用は短く（数行〜段落1つ） | 機械的に文字数チェック可能 |
| 出典必須（URL + 著者 + 日付） | frontmatter にも本文にも |
| 人間の最終編集なしに公開しない | `human_final_edit: true` がないと build エラー |
| 元発信者を批判的にではなく対話的に扱う | 文体検査（任意） |

## Tier 3 — Pillar（長尺記事）

### 性格
- 自社の核となる論点を **5,000 字以上** で展開
- 検索流入と LLMO 引用の主戦場
- 月 1 本ペースを目標
- Tier 2 の蓄積から編集される

### Frontmatter での区別
```yaml
type: pillar
rag_priority: 1
pillar_topic: ai-implementation-strategy  # 同 topic で系統化
```

## 引用倫理ガイドライン（全 Tier 共通）

```
1. 出典は必ず明示（URL + 著者名 + 日付）
2. 引用は短く、要点のみ（数行〜段落1つ）
3. 自分の見解が記事の主、引用は従
4. 批判ではなく対話の態度
5. 同意する部分を先に述べる
6. 反論するなら根拠と代案をセットで
7. 著名人の引用時は X / メールで一報（推奨）
8. embed は使わず、リンク + 引用テキスト
9. 引用元が削除されても記事が成立する書き方
10. 「公開記事だから自由」は法的にYesでも、関係的には別問題と心得る
```

## 記事の比率方針（運用目安）

| 種別 | 月の目安 | 用途 |
|---|---|---|
| Original Post（完全人力） | 2 本 | 自社事例・独自分析 |
| Voice-reaction Post | 4 本 | SNS 着想 + 音声反応 |
| Pillar | 1 本 | 主要トピックの体系化 |
| Thino（公開） | 30〜60 本 | 思考のライブ |

合計: 月 7 記事 + 30〜60 Thino。これで RAG コーパスが鮮度を保ち、サイトが「生きている」状態を維持できる。

## 古いコンテンツの扱い

### Article Update（Thino 経由）
- 過去記事を読み返したときに気付きを Thino で残す
- タグ: `#article-update`
- 月 1 回まとめてレビュー、必要なら updated 日付を更新

### Archive
- 1 年以上更新がなく、状況が変わって正確でなくなった記事は:
  - `draft: archived` に変更
  - 一覧からは除外、URL は維持
  - 冒頭に「この記事は YYYY 時点の情報です」を明記

## Command-C PWA との連携仕様（暫定・要確認）

> このセクションはユーザーから情報をもらって正確に書き直す。

期待する機能:
- SNS 投稿の収集とフィルタ
- 音声 → Whisper 文字起こし
- ドラフト生成（プロンプト・テンプレート管理）
- Thino → 記事への昇格 UI
- ガードレール検査（ユーザー発言にない事実の検出）

API インターフェース（想定）:
- `POST /api/pwa/thinos/promote` — Thino を記事化フローに送る
- `POST /api/pwa/posts/draft` — ドラフト生成
- `POST /api/pwa/posts/publish` — 最終公開
- `GET /api/pwa/queue` — レビュー待ちキュー
