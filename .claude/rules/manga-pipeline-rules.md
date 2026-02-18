## マンガパイプライン ルール・禁止事項

**作業を開始する前に `/manga-unified-pipeline` の内容をまず最初に読め！読まなかったらぶん殴る！そしてそこに書いてあるルール破ったら殺す！**

---

### Notionデータベース

| DB名 | 用途 | ID | URL |
|------|------|----|-----|
| manga-blogDB | 親行（キャラリファレンスシート）+ 子行（各コマ）登録 | `30bb802c-b0c6-8032-b834-e0e38cb393a1` | https://www.notion.so/effectmoe/30bb802cb0c68032b834e0e38cb393a1 |
| manga-translatorDB | 吹き出し文字の分類・編集（コマごとのテキスト管理） | `30bb802c-b0c6-8046-b51e-c641c81d0967` | https://www.notion.so/effectmoe/30bb802cb0c68046b51ec641c81d0967 |

---

### manga-unified-pipeline 禁止事項

- `--slug` なしで実行するな
- テーマもURLもパスも指定なしで実行するな
- ステージ1でbaoyu-comicのStep 7（画像生成）を実行するな
- baoyu-comicを呼ぶ際は必ず `--prompts-only` を指定すること
- 同時に2つ以上のパイプラインを並行実行するな（CDP Chrome競合）
- パイプライン実行中にChromeを手動操作するな
- ステージ1のStep 2確認でAskUserQuestionを使うな（自動承認）
- ステージ1失敗時にステージ2に進むな

---

### 絶対原則：Notion登録は画像生成より必ず先に行う

**NBP画像生成を始める前に、必ずNotion manga-blogDBへの登録を完了させること。**

順序:
1. プロンプト生成（baoyu-comic --prompts-only）
2. **Notion manga-blogDB: 親行（キャラリファレンスシート）登録 + characters画像アップロード** ← 画像生成より先
3. **Notion manga-blogDB: 子行（00〜NN）登録 + テキスト要素テーブル記入** ← 画像生成より先
4. NBP: 画像生成（Notion登録済みの状態で実施）

**Notionに書かずにいきなり画像生成するな。**

### 絶対原則：Notionページ作成時はプロパティとページ本文を同時に書け

**親行・子行を作成したとき、プロパティだけ設定して本文を空のままにするな。**

- 親行作成時: プロパティ登録 + characters.webp画像ブロック + 生成プロンプト + キャラクター定義 を**同時に**書き込め
- 子行作成時: プロパティ登録 + 構造化JSON + 自然言語プロンプト + テキスト要素テーブル + NBP生成手順callout を**同時に**書き込め
- 「後で書く」は禁止。作成と本文記入は1回のAPI呼び出しで完結させろ

---

### キャラリファレンスシートのHiggsField添付手順

**最初の1回だけ実施。一度添付したらセッション中は再添付不要。**

1. キャラリファレンスシート画像（characters.webp）をNBPで生成
2. HiggsFieldのギャラリーに表示されたキャラリファレンスサムネイル左下の **画像アイコンボタン（赤枠）** をPlaywright（またはMidscene）でクリック
3. クリックするとプロンプトモーダルに自動で添付される
4. 以降の画像生成（表紙・各コマ）はこの添付状態のまま実施

```
Playwright操作手順:
1. mcp__playwright__browser_snapshot でページ状態確認
2. キャラリファレンスサムネイルの画像アイコンボタンを特定
3. mcp__playwright__browser_click でクリック
4. 添付確認後、次の画像生成プロンプトを入力・送信
```

---

### NBP画像生成ルール（v2デザイン方針）

v1の失敗: 4:3横型・複数コマ詰め込み → スマホで読めない

**v2方針:**
- アスペクト比: **3:4縦型 portrait**（必須）
- **1画像 = 1キーシーン**（複数コマ詰め込み禁止）
- キャラクターは**大きく**（フレーム高さの60-70%）
- テキストは**画像に焼き込まない**（後からbubble-engine.mjsでオーバーレイ）

**全画像に必須の共通プロンプトプレフィックス:**
```
Modern manga style, 3:4 PORTRAIT orientation, single scene composition.
Clean lines, educational/business theme.
Characters drawn large (60-70% of frame height).
Text areas left as blank speech bubbles or caption zones for post-production overlay.
Navy/cyan/white palette with digital glow effects.
NO multi-panel grid. ONE focused scene per image.
```

各コマのプロンプトには**吹き出し数・配置位置**も具体的に記載すること
（例: "2 speech bubbles: one top-left, one bottom-right"）

---

### プロンプト生成ルール（Notion各子ページ構成）

各ページに**この順序で**以下を含める:

1. **構造化JSON**（NBP形式 / code/json）
2. **自然言語プロンプト**（code/plain text / 日本語）
3. **テキスト要素テーブル**（6列）: パネル / 読み順 / 種別 / テキスト内容 / 話者・位置 / 演出メモ

**種別（manga-translatorDBの `N_分類` と一致させること）:**
- `Dialogue bubble` - セリフ吹き出し（キャラクターの発言）
- `Thought bubble` - 思考吹き出し（内心・モノローグ）
- `Narrator box` - ナレーターボックス（説明・地の文）
- `Caption bar` - キャプションバー（タイトル・テロップ・効果音）

4. **NBP生成手順**（calloutブロック）

---

### 文字原稿の作成タイミング

- **テキスト要素テーブルはStep 3（Notion子行登録時）に画像プロンプトと同時に作成する**
- テキスト内容はその時点で確定させる（後から変更する場合はmanga-translatorDBで編集）
- **画像には焼き込まない** → bubble-engine.mjsで後からオーバーレイ

**NanoBananaProへの吹き出しスペース確保指示:**
共通プロンプトプレフィックスの以下の文が「吹き出し位置にスペースを空けておけ」という指示:
```
Text areas left as blank speech bubbles or caption zones for post-production overlay.
```
さらに各コマのプロンプトには**吹き出し数・配置位置**を具体的に記載すること（例: "2 speech bubbles: one top-left, one bottom-right"）。

---

### 文字入れ生成ルール（bubble-engine.mjs）

- **画像生成後**に実行（post-production）
- `manga_ultimate_pipeline` の **Step 4.5** で自動実行
- テキスト要素テーブルのデータを元に吹き出しを自動配置
- retypeset/Docker方式は**廃止**
- manga-translatorDBでコマごとのテキストを管理・編集可能（後から文字だけ修正する用途）

---

### manga-translatorDB 構造

1行 = 1コマ。各コマの吹き出しを最大11個まで管理。

| プロパティ | 型 | 内容 |
|-----------|-----|------|
| 名前 | title | コマ識別名 |
| バブル数 | number | 吹き出し数 |
| 画像パス | text | 元画像ファイルパス |
| クリーン画像パス | text | テキスト消去後の画像パス |
| フォントパス | text | フォントファイルパス |
| 方向 | select | horizontal / vertical / auto |
| ステータス | select | registered / synced |
| N_分類 (N=1〜11) | select | Dialogue bubble / Thought bubble / Narrator box / Caption bar |
| N_テキスト (N=1〜11) | text | 編集後テキスト |
| N_元テキスト (N=1〜11) | text | 元のテキスト |
| N_フォントサイズ (N=1〜11) | number | フォントサイズ |

---

### ワークフロー（正しい順序）

```
1. baoyu-comic --prompts-only
   → プロンプト・キャラ定義生成（comic/{slug}/prompts/*.md, characters/characters.md）

2. Notion manga-blogDB: 親行（キャラリファレンスシート）登録
   + characters.webp をアップロードして埋め込み

3. Notion manga-blogDB: 子行（00〜NN）登録
   + テキスト要素テーブル（4種の分類で記入）
   + NBP生成手順callout

4. NBP: 画像生成（1枚=1シーン、テキストなし、3:4縦型）
   ※ 共通プロンプトプレフィックスを必ず付ける

4.5. bubble-engine.mjs: テキストオーバーレイ（自動）
   → manga-translatorDBにコマ情報を登録

5. HD復元（Real-ESRGAN 4x）

6. HTML記事生成（SEO/LLMO最適化）

7. TTS音声生成（VOICEVOX）
```

---

### manga-nbp-pipeline 禁止事項

- マンガDB以外のDBに登録するな
- mdファイルにプロンプトを書いて「完成」と言うな
- 指示されていないDBを勝手に作るな
- エラーを放置して手動ワークアラウンドに逃げるな
