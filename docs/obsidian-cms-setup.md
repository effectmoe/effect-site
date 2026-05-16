# Obsidian-as-CMS セットアップ

> `src/content/` を Obsidian Vault として運用する設定手順。
> Obsidian で書く → git push → Cloudflare Pages ビルド → 公開 のフローを作る。

---

## 全体像

```
[ローカル MacBook Pro]
~/Projects/effect-site/acacia-studio/src/content/
   ↑ ここを Obsidian Vault として開く
   ↑ Thino で つぶやき (src/content/thinos/)
   ↑ 通常ノートで 記事 (src/content/posts/)
   ↓ Obsidian Git で自動コミット & push
[GitHub: effect-site/acacia-studio]
   ↓
[Cloudflare Pages: brain-effect-moe]
   ↓ build (astro build)
[effect.moe]
```

## ステップ 1: Vault として開く

Obsidian を起動し:

1. `Open another vault` をクリック
2. `Open folder as vault` を選択
3. `~/Projects/effect-site/acacia-studio/src/content` を指定

これで Vault として認識される。

## ステップ 2: `.obsidian/` ディレクトリの扱い

Obsidian が自動で `src/content/.obsidian/` を作成する。

**重要**: これは個人設定なので git に含めない。

### .gitignore に追加

```gitignore
# Obsidian 個人設定（Vault 内）
src/content/.obsidian/workspace.json
src/content/.obsidian/workspace-mobile.json
src/content/.obsidian/graph.json
src/content/.obsidian/canvas.json
src/content/.obsidian/community-plugins.json

# その他 Obsidian キャッシュ
src/content/.obsidian/cache/
src/content/.obsidian/plugins/*/data.json
```

ただし以下は git にコミットして良い（チーム共有 / 別 PC 移行の利便性）:
- `src/content/.obsidian/plugins/<plugin-name>/main.js` （任意）
- `src/content/.obsidian/templates/` （テンプレート共有用）

選択肢:
- **保守的**: `.obsidian/` 全体を gitignore
- **共有派**: `workspace.json` 等の個人設定だけ gitignore

推奨は **保守的**（全体 gitignore）— Obsidian の設定は個人 PC ごとに異なるため。

## ステップ 3: 必須プラグイン

### コアプラグイン（Obsidian 標準）
- Templates — ON
- Daily notes — ON
- Tag pane — ON

### コミュニティプラグイン
1. **Templater** — frontmatter テンプレート自動挿入
2. **Obsidian Git** — 自動コミット & push
3. **Thino** — つぶやきキャプチャ
4. **Dataview** — メタ情報の集計（任意）
5. **Various Complements** — タグ補完（任意）

## ステップ 4: Templater 設定

### 4-1. テンプレート保存先
`src/content/.obsidian/templates/` を使う（または `.templates/`）

### 4-2. 記事テンプレート

`post-template.md`:
```markdown
---
title: <% tp.file.title %>
description: 
date: <% tp.date.now("YYYY-MM-DD") %>
draft: true

type: post
category: 
tags: []
audience: []

rag_indexed: true
rag_priority: 2

source:
  type: original

human_final_edit: false
---

# <% tp.file.title %>

`,
```

### 4-3. 音声反応記事テンプレート

`voice-reaction-template.md`:
```markdown
---
title: 
description: 
date: <% tp.date.now("YYYY-MM-DD") %>
draft: true

type: post
category: 
tags: []

rag_indexed: true
rag_priority: 2

source:
  type: voice-reaction
  inspired_by:
    - url: 
      author: 
      title: 
      accessed: <% tp.date.now("YYYY-MM-DD") %>
  voice_memo: ./voice-memo.m4a
  transcript: ./voice-memo-transcript.md
  seed_thino: 

human_final_edit: false
---

# 

## 着想元

> 

— [著者名]([URL])

## 自分の見解



## effect.moe での実践



```

### 4-4. Pillar 記事テンプレート

`pillar-template.md`:
```markdown
---
title: 
description: 
date: <% tp.date.now("YYYY-MM-DD") %>
draft: true

type: pillar
category: 
tags: []
audience: [decision-maker, practitioner]

rag_indexed: true
rag_priority: 1

source:
  type: original

human_final_edit: false
pillar_topic: 
---

# 

## 目次
- [ ] イントロ
- [ ] 主論
  - [ ] 論点 1
  - [ ] 論点 2
  - [ ] 論点 3
- [ ] 反論への応答
- [ ] 結論
- [ ] FAQ
```

## ステップ 5: Thino 設定

### 5-1. 保存先設定
Thino プラグイン設定で:
- **Save mode**: Daily Note
- **Daily Note folder**: `thinos/`
- **File format**: `YYYY-MM-DD`
- **Entry format**: 下記参照

### 5-2. Thino エントリのフォーマット

```markdown
---
date: 2026-05-16
---

## 17:42  #public #ai-news
Claude Opus 4.7 リリース。1M context の実効性能要検証。

---

## 19:13  #public #thoughts
RAG はコーパスの質 > 量。
```

各エントリは `## HH:MM #tag1 #tag2` で始まり、本文が続く。
`#public` がついたものだけサイト公開。

### 5-3. 公開タグの方針

**デフォルト非公開、明示的に `#public` でオプトイン**。
理由: 個人メモやクライアント情報の意図しない公開を防ぐため。

## ステップ 6: Obsidian Git 設定

### 6-1. プラグイン設定

| 設定項目 | 値 |
|---|---|
| Vault backup interval | 5 分 |
| Auto pull interval | 10 分 |
| Auto push interval | 5 分 |
| Commit message format | `obsidian: {{date}}` |
| List filenames in commit message | OFF |
| Pull before push | ON |

### 6-2. .gitignore の更新

リポジトリルートの `.gitignore` に追加:

```gitignore
# Obsidian 個人設定
src/content/.obsidian/

# 音声メモ（公開しないもの。必要ならパスを調整）
src/content/posts/**/voice-memo.m4a
src/content/posts/**/voice-memo.mp3
```

**注意**: 音声メモを git に含めるかは判断ポイント。
- 含める: 完全アーカイブ、サイズ問題は LFS で対応
- 含めない: ローカルのみで管理、サイトに公開しない

推奨は **「含めない、ただしトランスクリプトは含める」**。
理由: バイナリは git に重い、サイトでは公開しない、トランスクリプトは検索可能。

### 6-3. 認証

GitHub の SSH 鍵 or PAT を設定済みであること。
未設定の場合:

```bash
# SSH 鍵を作成
ssh-keygen -t ed25519 -C "tonychu-mbp"
# 公開鍵を GitHub に登録
cat ~/.ssh/id_ed25519.pub
# → GitHub Settings → SSH and GPG keys

# git remote を SSH に変更
git remote set-url origin git@github.com:tonychu/effect-site.git
```

## ステップ 7: Whisper による音声トランスクリプト

### 7-1. 実行環境
Mac Studio (mac-studio / 100.90.192.79) で常時稼働。

### 7-2. ワークフロー

```
[iPhone で音声録音]
   ↓ AirDrop or iCloud
[~/Projects/effect-site/acacia-studio/src/content/posts/[slug]/voice-memo.m4a]
   ↓ Mac Studio で Whisper を実行（cron / launchd）
[voice-memo-transcript.md が同ディレクトリに生成]
```

### 7-3. Whisper 実行スクリプト例

`scripts/transcribe.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="${1:?usage: transcribe.sh <post-dir>}"
cd "$DIR"

# Whisper.cpp または OpenAI Whisper Python
whisper voice-memo.m4a \
  --model large-v3 \
  --language ja \
  --output_format md \
  --output_dir .

mv voice-memo.md voice-memo-transcript.md
echo "✓ Transcribed: $DIR"
```

### 7-4. 自動実行（任意）

launchd or fswatch で `src/content/posts/**/voice-memo.m4a` が追加されたら自動で文字起こし:

```bash
fswatch -0 src/content/posts/ | while read -d "" file; do
  if [[ "$file" == *voice-memo.m4a ]]; then
    dir=$(dirname "$file")
    if [[ ! -f "$dir/voice-memo-transcript.md" ]]; then
      ./scripts/transcribe.sh "$dir"
    fi
  fi
done
```

## ステップ 8: 日々の運用フロー

### つぶやきだけ残す日（多い）

```
[iPhone / Mac]
1. Obsidian モバイル / デスクトップ起動
2. Thino でホットキー（Cmd+P → Thino: New）
3. 30秒で 1〜2 行書く
4. 必要に応じてタグ #public をつける
5. Obsidian Git が 5 分後に自動 push
   ↓
[GitHub → Cloudflare Pages]
   ↓
[effect.moe/thinos に公開]
```

### 記事にする日

```
1. SNS で気になる投稿を見つける
2. Thino で 30 秒キャプチャ #seed #to-voice タグ
3. 音声反応を録音 30 秒〜10 分 (iPhone 音声メモ)
4. Mac に転送、所定のディレクトリに置く
5. Whisper が自動で文字起こし
6. Command-C PWA で記事ドラフト生成
7. Obsidian で開いて最終編集
8. draft: false にして save
9. Obsidian Git が push、Cloudflare Pages がビルド
   ↓
[effect.moe/posts/[slug] に公開]
```

## トラブルシューティング

### Obsidian Git が push に失敗する
- ターミナルで `git push origin master` を試す
- 認証エラーなら SSH 鍵 or PAT を確認

### Thino エントリがサイトに出ない
- Daily note の保存先が `src/content/thinos/` になっているか確認
- ファイル名が `YYYY-MM-DD.md` 形式になっているか
- `#public` タグがついているか

### 画像がサイトに出ない
- 画像は記事と同じディレクトリに置く: `src/content/posts/[slug]/hero.webp`
- frontmatter で `heroImage: ./hero.webp` のように相対パス

### ビルドエラー: frontmatter のバリデーションエラー
- `src/content.config.ts` のスキーマと frontmatter を見比べる
- 必須フィールド（title, date 等）が抜けていないか確認

## 別 PC との同期について

Vault は git で同期されるので、別 Mac でも:

```bash
cd ~/Projects && git clone git@github.com:tonychu/effect-site.git
cd effect-site/acacia-studio
# Obsidian で src/content を Vault として開く
```

Obsidian Sync ($4/月) は不要。Obsidian Git で十分。

ただし、モバイル（iPhone / iPad）からも編集したい場合は:
- **Obsidian Sync**: $4/月、最も楽
- **iCloud / Working Copy**: 無料、git クライアント iOS アプリ
- **GitHub mobile app**: 限定的だが可

推奨は **Obsidian Sync**（モバイル編集を頻繁にするなら）。

## .obsidian/ に置くべきテンプレ集（コミットして良い場合）

リポジトリに含めて他 PC で再利用したい場合:

```
src/content/.obsidian/templates/
├── post.md
├── voice-reaction.md
└── pillar.md
```

これらは `.gitignore` から除外する設定にする:

```gitignore
src/content/.obsidian/*
!src/content/.obsidian/templates/
!src/content/.obsidian/templates/**
```

## 完了チェックリスト

- [ ] `src/content/` を Obsidian Vault として開いた
- [ ] `.obsidian/` を gitignore に追加
- [ ] Templater プラグインをインストール、テンプレート3種を配置
- [ ] Thino プラグインをインストール、保存先を `thinos/` に設定
- [ ] Obsidian Git プラグインをインストール、自動 push 設定
- [ ] Whisper 実行環境を Mac Studio に構築
- [ ] 試しに Thino を1件投稿して GitHub に push されることを確認
- [ ] Cloudflare Pages のビルドが成功することを確認
- [ ] `/thinos` ページに投稿が表示されることを確認
