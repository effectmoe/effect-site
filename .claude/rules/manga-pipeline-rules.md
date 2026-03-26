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
- **HiggsFieldは同時最大4枚まで生成可能**（4枚を超えないように管理すること）
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

### HiggsField Chrome CDP UI制御（絶対に読め）

#### ⚠️ CRITICAL: Playwright MCPはHiggsField操作に使えない

| Chrome | ポート | ログイン状態 | 用途 |
|--------|--------|------------|------|
| ms-playwright/mcp-chrome-main | 62795 | **ログアウト済み** | Playwright MCP（HiggsField操作不可）|
| .chrome-cdp-profile | **18800** | **ログイン済み** | nbp-generate.mjs + CDP直接制御（正解）|

**`mcp__playwright__browser_snapshot` はHiggsFieldに使うな。必ずCDP WebSocket（port 18800）で直接制御すること。**

#### CDP接続手順

```bash
# 1. タブリスト確認（TAB_IDを取得）
curl -s http://localhost:18800/json | head -30

# 2. Node.jsスクリプトでCDP WebSocket直接制御
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:18800/devtools/page/{TAB_ID}');
let id = 1;
const send = (method, params={}) => new Promise(r => {
  const msgId = id++;
  ws.once('message', (data) => { const d = JSON.parse(data); if (d.id === msgId) r(d.result); });
  ws.send(JSON.stringify({id: msgId, method, params}));
});
ws.on('open', async () => {
  // ここに操作コードを書く
  ws.close();
});
"
```

#### CDP操作パターン集（コピペして使え）

**モーダル（アップグレードポップアップなど）を閉じる:**
```javascript
await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', keyCode: 27});
await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', keyCode: 27});
```

**添付画像の枚数を確認:**
```javascript
const result = await send('Runtime.evaluate', {expression: `
  (() => {
    const form = document.querySelector('.image-form');
    if (!form) return 0;
    const imgs = Array.from(form.querySelectorAll('img')).filter(img => img.width < 120);
    return imgs.length;
  })()
`, returnByValue: true});
const count = result.result.value; // 0なら添付なし
```

**添付画像のサムネイル位置を取得 → × ボタンをクリック:**
```javascript
const result = await send('Runtime.evaluate', {expression: `
  (() => {
    const form = document.querySelector('.image-form');
    const imgs = Array.from(form.querySelectorAll('img')).filter(img => img.width < 120);
    if (imgs.length === 0) return null;
    const rect = imgs[0].getBoundingClientRect();
    return {x: rect.right - 5, y: rect.top + 5, count: imgs.length};
  })()
`, returnByValue: true});
const {x, y} = result.result.value;
// × ボタンはサムネイル右上隅にある
await send('Input.dispatchMouseEvent', {type:'mousePressed', x, y, button:'left', clickCount:1});
await send('Input.dispatchMouseEvent', {type:'mouseReleased', x, y, button:'left', clickCount:1});
```

**ギャラリー画像をクリックしてディテールパネルを開く:**
```javascript
// ギャラリー内の最新サムネイル位置を特定してクリック
await send('Input.dispatchMouseEvent', {type:'mousePressed', x:150, y:300, button:'left', clickCount:1});
await send('Input.dispatchMouseEvent', {type:'mouseReleased', x:150, y:300, button:'left', clickCount:1});
```

**ディテールパネルで「Reference」ボタンを探してクリック（キャラリファレンス添付）:**
```javascript
const result = await send('Runtime.evaluate', {expression: `
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const refBtn = btns.find(b => b.textContent.trim() === 'Reference');
    if (!refBtn) return null;
    const rect = refBtn.getBoundingClientRect();
    return {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
  })()
`, returnByValue: true});
const {x, y} = result.result.value;
await send('Input.dispatchMouseEvent', {type:'mousePressed', x, y, button:'left', clickCount:1});
await send('Input.dispatchMouseEvent', {type:'mouseReleased', x, y, button:'left', clickCount:1});
// 確認: 添付枚数が1になっているか確認する
```

**既知のボタン座標（ディテールパネル内、画面解像度依存）:**
| ボタン | 座標（参考値）|
|--------|------------|
| Reference | (1051, 1165) |
| Download | (880, 1221) |

---

### キャラリファレンスシートのHiggsField添付手順

**生成順序の厳守（必ず守ること）:**

#### Step 0: 添付画像の削除（毎回セッション開始時に必須）

**キャラリファレンスシートを生成する前に、前セッションの残存添付画像を必ず全削除すること。**

⚠️ **添付画像は1枚だけとは限らない。前のセッションで最大10枚添付されている場合がある。添付画像が0枚になるまで繰り返し削除すること。**

```
CDP制御手順（正しい方法）:
1. curl -s http://localhost:18800/json でTAB_IDを取得
2. CDP Runtime.evaluate で .image-form img (width<120) の枚数確認
3. 枚数 > 0 なら: imgs[0].getBoundingClientRect() で座標取得 → 右上隅の × をクリック
4. 枚数が0になるまで繰り返す
5. 0枚を確認してから次に進む

※ mcp__playwright__browser_snapshot は使うな（ログアウト済みChromeにつながる）
```

⚠️ **この削除をせずにプロンプトを送ると、誤った参考画像で生成されてしまう。絶対に省略するな。**
⚠️ **1枚削除して終わりにするな。必ず0枚になるまで全削除すること。**

#### Step 1: キャラリファレンスシートを生成（添付画像なしで実施）

1. キャラリファレンスシート画像（characters.webp）をNBPで生成（添付画像が0枚の状態で実行、**アスペクト比は3:4**。baoyu-comicの4:3デフォルトを使うな）
2. 生成完了 → ギャラリーにサムネイルが表示される
3. ⚠️ nbp-generate.mjs が「タイムアウト」を返しても、HiggsField側では生成されている可能性がある。ギャラリーを確認すること。

#### Step 2: キャラリファレンスシートを添付（2枚目以降に使用）

3. CDPでギャラリーのキャラリファレンスサムネイルをクリック → ディテールパネルを開く
4. CDPで「Reference」ボタンを探してクリック → プロンプトエリアに自動添付される
5. `.image-form img` 枚数が1になっていることをCDPで確認

#### Step 3: 以降の画像生成（3枚目〜）

6. 一度添付したらセッション中は **再添付不要**（添付状態がキープされる）
7. 表紙・各コマの画像生成はこの添付状態のまま実施

---

### 画像生成モード選択（事前に必ず選択すること）

指示が無い場合はMode Aを使う。ユーザーが明示的にB/Cを指定した場合のみ変更可：

| モード | タイトル | 吹き出し | 用途 |
|--------|---------|---------|------|
| **A** | 焼き込み | テキスト入り | 表紙・序盤など完成形をそのまま使う場合 |
| **B** | なし | テキスト入り | タイトルは後付け、セリフはAI生成に任せる場合 |
| **C** | なし | 空白 | テキストは全て後工程（bubble-engine.mjs）で入れる場合 |

**モードに応じたプロンプト指示:**
- **モードA**: プロンプトにタイトルテキストと吹き出しセリフを明記する
- **モードB**: プロンプトにタイトル指示を含めず、吹き出しセリフのみ明記する
- **モードC**: プロンプトに「blank speech bubbles, no text, no title」を明記する

**後工程（モードC）のフォント一致ルール:**
- モードCの空白吹き出しへのテキスト追加は必ずbubble-engine.mjsで実施
- **同一マンガ内でモードAの焼き込みフォントと同じフォント・サイズ・スタイルに合わせること**

### 言語ルール（絶対厳守）

**このマンガは日本人向けコンテンツ。吹き出し・ナレーション・キャプションの文字は全て日本語で生成すること。**

- モードA（文字焼き込み）: プロンプトにセリフを記載する際、**日本語テキストをそのまま明記**すること
  - 例（正）: `speech bubble: 「え…うちのサイト、検索結果に出てるのにクリックされない…？」`
  - 例（誤）: `speech bubble: "Why isn't my site getting clicks?"`
- AIが英語で文字を生成した場合は、manga-text-fixで日本語に差し替えること
- **プロンプトは英語で書いてよい**（HiggsFieldへの指示は英語）。ただし吹き出しの文字内容は日本語を明示すること

---

### 画像生成の高速化ルール（yoloモード）

**画像生成はyoloモードで実行し、待ち時間ゼロで一気に回せ。**

#### yoloモードとは

Claude Code の `--dangerously-skip-permissions` フラグを使い、ツール承認ダイアログをスキップするモード。
画像生成バッチは必ずyoloモードで実行すること（通常モードだと各コマンドごとにユーザー承認待ちになり激遅）。

#### 並列生成ルール（HiggsField同時生成の正しい理解）

**「4枚並列」= HiggsField NanoBananaProはアカウント全体で同時生成4枚が上限。ユーザー（手動）とAI（CDP）の合計で4枚。ユーザーが1枚生成中ならAIは3枚まで。**

**正しい手順:**
1. 1枚目のプロンプトを入力 → 生成ボタンクリック（完了を待たない）
2. 2枚目のプロンプトを入力 → 生成ボタンクリック（完了を待たない）
3. 3枚目のプロンプトを入力 → 生成ボタンクリック（完了を待たない）
4. 4枚目のプロンプトを入力 → 生成ボタンクリック（完了を待たない）
5. → HiggsFieldが4枚を同時生成中（キューイング）
6. 1枚完了したら → 5枚目のプロンプトを入力 → 生成ボタンクリック
7. 常に最大4枚が生成中の状態を維持する
8. 全枚数完了まで繰り返す

**これは1つのCDPタブ内での操作。複数のnbp-generate.mjsプロセスを同時起動するな。**
**ユーザーが手動で生成中の場合、その分を差し引いて投入枚数を調整すること。**

- **出力先を必ず指定**: `--output ~/projects/effect-site/comic/{slug}/output/` を必ず付けること（/Downloads に保存するな）

#### 禁止パターン

- ❌ nbp-generate.mjsを4プロセス同時起動する（CDPタブ競合で全部壊れる）
- ❌ 1枚生成完了を待ってから次の1枚を投入する（遅すぎる）
- ❌ 各Bash呼び出しをユーザー承認待ちにする（yoloモード未使用）
- ❌ `/Downloads` に保存して後から移動する
- ❌ 生成後すぐNotionアップロードせずに待機する

---

### NBP画像生成ルール（v2デザイン方針）

v1の失敗: 4:3横型・複数コマ詰め込み → スマホで読めない

**v2方針:**
- 画像生成AIは**NanoBananaPro**を使う（Unlimitedモードにチェックを入れること）
- 生成サイト: **HiggsField**（https://higgsfield.ai）がデフォルト
- フォールバック: HiggsFieldが使えない場合（ダウン・ログイン不可・エラー）は**ChatArt**（https://app.chatartpro.com）を使う
- アスペクト比: **3:4縦型 portrait**（必須）、解像度: **1K**
- **1画像 = 1キーシーン**（複数コマ詰め込み禁止）
- キャラクターは**大きく**（フレーム高さの60-70%）
- テキストは**モード選択に従う**（指示が無い場合はMode A「焼き込み／テキスト入り」を使う）

**全画像に必須の共通プロンプトプレフィックス:**
```
Modern manga style, 3:4 PORTRAIT orientation, single scene composition.
Clean lines, educational/business theme.
Characters drawn large (60-70% of frame height).
Navy/cyan/white palette with digital glow effects.
NO multi-panel grid. ONE focused scene per image.
```

各コマのプロンプトには**吹き出し数・配置位置**も具体的に記載すること
（例: "2 speech bubbles: one top-left, one bottom-right"）

**プロンプト長さ制限と重複禁止:**
- キャラリファレンスシートをHiggsFieldに画像添付済みの場合、**プロンプトにキャラクター外見の詳細説明を書くな**（二重記述はRestricted content検出の原因になる）
- プロンプトは**シーン描写・構図・カラーに絞る**（キャラ説明はリファレンス画像に任せる）
- **HiggsFieldのプロンプト文字数上限は5000文字**。超えると入力できない
- 文字数超過時はキャラ説明・スタイル指示を削り、シーン描写のみに絞れ

**架空名・捏造テキスト防止（絶対禁止）:**
- プロンプトに「author info」「series info」「publisher」「credit」等の曖昧なテキスト指示を書くな
- HiggsFieldは曖昧な指示を受けると架空の人名・出版社名を捏造する
- テキストを画像に入れたい場合は**必ず具体的な文字列を明示**すること（例: `The text "effect.moe" displayed at bottom`）
- 「ここにテキストを入れるスペース」等の曖昧な指示も禁止（`label zone`、`text area`、`zone for`）
- 実在しない人名・組織名が画像に焼き込まれると法的リスクになる

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
- **指示が無い場合はMode A「焼き込み／テキスト入り」を使う**（プロンプトに日本語セリフを明記して画像に焼き込む）
- Mode B/C選択時のみ、bubble-engine.mjsで後工程テキスト追加を行う

各コマのプロンプトには**吹き出し数・配置位置・セリフ内容**を具体的に記載すること（例: "speech bubble top-left containing: 「セリフ内容」"）。

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

4. NBP: 画像生成（1枚=1シーン、3:4縦型、指示が無い場合はMode A「焼き込み／テキスト入り」）
   ※ 共通プロンプトプレフィックスを必ず付ける

4.5. bubble-engine.mjs: テキスト修正（Mode B/C選択時、または焼き込み文字の修正が必要な場合）
   → manga-translatorDBにコマ情報を登録

5. HD復元（Real-ESRGAN 4x）

6. HTML記事生成（SEO/LLMO最適化）

7. TTS音声生成（VOICEVOX）
   → 話者ラベル付きトランスクリプト → マルチスピーカー音声 → R2アップロード → D1更新
```

---

### TTS音声生成ルール（VOICEVOX マルチスピーカー）

**スクリプト**: `scripts/regenerate-tts.mjs --slug <slug>`
**VOICEVOX**: `http://localhost:50021`（Docker or ローカル）

#### ボイスマッピング（確定・変更禁止）

| キャラクター | VOICEVOX Speaker ID | 声の名前 | スタイル |
|-------------|---------------------|----------|---------|
| **LUCA / ルカ** | 3 | ずんだもん | ノーマル |
| **ナレーション** | 3 | ずんだもん | ノーマル |
| **ユウ / Yuu** | 13 | 青山龍星 | ノーマル |
| **リク / Riku / ライバル** | 11 | 玄野武宏 | ノーマル |
| **default** | 3 | ずんだもん | ノーマル |

**絶対禁止:**
- ユーザーの明示的な指示なしにSpeaker IDを変更するな
- 「熱血」「ツンギレ」等のバリアントスタイルを勝手に使うな（声がパネルごとにバラバラになる）
- ナレーションをずんだもん以外に変更するな
- speedScaleは全キャラ **1.0** 固定（勝手に変えるな）

#### トランスクリプト話者ラベル規則（最重要）

D1の `panels.transcript` カラムに格納するテキストには、**必ず全セグメントに話者ラベルを付けること。**

**正しい形式:**
```
ユウ：サイトは検索に出てるのに…クリックが全然来ない！
ナレーション：AI Overviewが検索の最上位を占め、ユーザーはもうリンクをクリックしない時代が来た。
```

**間違い（話者ラベルなし → 全てずんだもんナレーションになる）:**
```
サイトは検索に出てるのに…クリックが全然来ない！ AI Overviewが検索の最上位を占め...
```

**ラベル付けルール:**

| テキストの種類 | 話者ラベル | 例 |
|--------------|----------|-----|
| キャラのセリフ | `ユウ：` `LUCA：` `ライバル：` | `ユウ：全部やる！` |
| 地の文・解説・定義 | `ナレーション：` | `ナレーション：LLMOとはAIに自社情報を引用させる施策。` |
| 表紙タイトル読み上げ | `ナレーション：` | `ナレーション：LLMO対策入門` |
| キャプション・箇条書き | `ナレーション：` | `ナレーション：FAQ形式・表・箇条書き・更新日。` |

**セリフと解説が混在するパネルの分割ルール:**
```
LUCA：ChatGPTはシェア60%！まずここを攻めよう。
ナレーション：ChatGPT対策：ブランド名を言及させる。AI Overview対策：検索上位＋構造化データ。
ユウ：LLMによって攻め方が全然違うんだ…！
ナレーション：2025年現在、まずChatGPTとGeminiへの対策を優先することが現実的だ。
```

**キャラのセリフの後に続く解説文を、そのキャラの発言として読ませるな。必ず `ナレーション：` で分離しろ。**

#### parseTranscript の仕組み

`regenerate-tts.mjs` のパーサーは以下のルールで分割する:
1. `LUCA：` `ユウ：` `ライバル：` `ナレーション：` 等の話者ラベル（全角/半角コロン対応）で分割
2. ラベルなしのテキスト → `ナレーション`（ずんだもん）にフォールバック
3. 話者が切り替わるたびに **0.3秒の無音ギャップ** を挿入

認識される話者名: `LUCA`, `ユウ`, `リク`, `ライバル`, `ナレーション`, `ルカ`, `Yuu`, `Riku`
**新キャラを追加する場合は `SPEAKER_MAP` と正規表現パターンの両方を更新すること。**

#### 音声生成フロー

```
1. VOICEVOX接続確認（localhost:50021）
2. D1からtranscript取得（panels テーブル）
3. パネルごとにparseTranscript → セグメント分割
4. セグメントごとにVOICEVOX audio_query → synthesis → WAV保存
5. パネル内セグメントをffmpeg concatで結合（話者切替時に0.3s gap）
6. パネル間に0.8s無音を挿入
7. 全パネルをffmpeg concatで最終WAV → MP3変換（128kbps）
8. anchors配列を生成: [{panel: N, start_sec: X.XX}, ...]
```

#### R2アップロード・D1更新手順

**⚠️ wrangler R2/KV コマンドには必ず `--remote` フラグを付けること（デフォルトはlocalで本番に反映されない）**

```bash
# 1. MP3をVMに転送
scp comic/{slug}/audio/audio.mp3 monchan@10.211.55.7:/tmp/{slug}-audio.mp3

# 2. R2にアップロード（--remote 必須）
ssh monchan@10.211.55.7 '... npx wrangler r2 object put effect-site-media/manga/{slug}/audio-vN.mp3 --file /tmp/{slug}-audio.mp3 --content-type audio/mpeg --remote'

# 3. D1更新（SQLファイル経由 — インラインSQLはJSON引用符のエスケープが壊れる）
cat > /tmp/update-audio.sql << 'EOF'
UPDATE articles
SET audio_url = 'https://effect-site.openclaw-agent.workers.dev/media/manga/{slug}/audio-vN.mp3',
    audio_anchors = '[{"panel":0,"start_sec":0},{"panel":1,"start_sec":6.27},...}]'
WHERE slug = '{slug}';
EOF
scp /tmp/update-audio.sql monchan@10.211.55.7:/tmp/update-audio.sql
ssh monchan@10.211.55.7 '... npx wrangler d1 execute effect-site-db --remote --file /tmp/update-audio.sql'

# 4. KVキャッシュクリア（--remote 必須）
ssh monchan@10.211.55.7 '... npx wrangler kv key delete --namespace-id=28ffe2354a8d43158592b036e22aa49a "article:{slug}" --remote'
```

**ファイル名はバージョン付き（audio-v2.mp3等）にすること。R2は `Cache-Control: immutable` なので、同名ファイルを上書きしてもCDNキャッシュが残る。**

#### フロントエンド音声同期（use-audio-sync.ts）

- `audio_anchors` は D1に `[{panel, start_sec}]` 形式で保存
- `d1.server.ts` の `parseArticle` が `start_sec` → `{panel, start, end}` に正規化（endは次のanchorのstart）
- Swiper `slideChangeTransitionEnd` イベント後に250msの快適ポーズを入れてから次パネルの音声再生開始
- スワイプ中に音声再生中だった場合、シーク後に自動再開（`wasPlaying` チェック）

---

### 画像添付ルール（必須）

**画像生成後の添付手順を省略するな。**

| タイミング | 添付先 | 方法 |
|-----------|--------|------|
| HiggsField生成直後 | 各子行ページの**ページ本文**に画像ブロック | `notion_append_block_children` でimageブロック追加 |
| bubble-engine.mjs完成後 | 各子行の**「完成画像」プロパティ** | `notion_update_page_properties` でfileプロパティに添付 |

- 生成画像をローカル保存したら即座にNotionページ本文に画像ブロックとして添付せよ
- 文字入れ完成画像はNotion「完成画像」プロパティ（file型）にアップロードせよ
- どちらも省略禁止

### manga-nbp-pipeline 禁止事項

- マンガDB以外のDBに登録するな
- mdファイルにプロンプトを書いて「完成」と言うな
- 指示されていないDBを勝手に作るな
- エラーを放置して手動ワークアラウンドに逃げるな

---

### Validation Gate ルール（コードレベル強制停止）

以下の `rule` ブロックは Validation Gate System が動的にパースし、違反時に RULE_VIOLATION エラーで処理を強制停止する。

#### Gate 0: 画像生成前の必須チェックリスト（1つでも違反したら生成するな）

**画像を1枚でも生成する前に、以下の6項目を全て確認しろ。1つでもNGなら即停止。**

| # | チェック項目 | 正解 | やったら殺す |
|---|------------|------|------------|
| 0-1 | モデル | **NanoBananaPro** | NanoBananaPro以外で生成する |
| 0-2 | サイト | **HiggsField**（ダメならChatArt） | 両方以外のサイトで生成する |
| 0-3 | テキストモード | **Mode A（焼き込み／テキスト入り）** ※ユーザーがB/Cを指定した場合のみ変更可 | ユーザーに聞かずに勝手にMode B/Cを選ぶ |
| 0-4 | アスペクト比 | **3:4（縦型portrait）** | 4:3や16:9で生成する |
| 0-5 | 解像度 | **1K** | 1K以外で生成する |
| 0-6 | Unlimitedモード | **チェックを入れる** | Unlimitedをオフのまま生成する |
| 0-7 | プロンプト文字数 | **5000文字以内** | 5000文字を超えるプロンプトを送る |

```rule
name: v2_generation_params
target: manga_image_generation
field: all_params
condition: model=NanoBananaPro AND site=HiggsField|ChatArt AND mode=A(default) AND ratio=3:4 AND resolution=1K AND unlimited=true AND prompt_length<=5000
error: v2方針の必須パラメータに違反しています。上の表を見ろ。1つでもNGなら画像生成は禁止。RULE_VIOLATION で強制停止。
```

#### Gate 0.5: 並列生成の正しい実行方法

**HiggsFieldの「4枚同時生成」は、1つのタブ内で生成ボタンを4回クリックしてキューイングすること。**

```rule
name: parallel_generation_method
target: manga_image_generation
field: execution_method
condition: single_tab_queue=true AND max_concurrent=4(account_total) AND no_multi_process=true
error: 並列生成の方法が間違っています。nbp-generate.mjsを複数プロセス同時起動するな。1つのCDPタブ内でプロンプト入力→生成クリックを繰り返せ。同時生成上限4枚はアカウント全体の合計（ユーザー手動+AI自動）。ユーザーが手動生成中ならその分を差し引け。RULE_VIOLATION で強制停止。
```

**正しい手順:**
1. プロンプト入力→生成クリック（待たない）×4回 = 4枚同時生成中
2. 1枚完了 → 次の1枚を投入（常に最大4枚を生成中に維持）
3. 全枚数完了まで繰り返す

**重要:** 4枚は全て別々のページ（別々のプロンプト）を同時生成すること。同じプロンプトを4枚作るな。
**禁止:** nbp-generate.mjsを4プロセス並列起動する（CDPタブ競合で全壊する）

**空き枠検知（必須実装）:**
- 4枚同時生成中に1枚が先に完了したら、残り3枚の完了を待たずに即座に次のプロンプトを空いたタブに投入しろ
- `Promise.all`で全完了を待つな。`Promise.race`等で最初の完了を検知し、空いたタブに次のジョブを即投入する
- 常に最大4枚が生成中の状態を維持すること（=ワーカープール方式）
- これにより11枚を3バッチ（4+4+3）ではなく、常時4枚稼働で最速で回せる

#### Gate 1: Notion登録なしに画像生成を開始するな

```rule
name: notion_before_images
target: manga_ultimate_pipeline
field: notion_registered
condition: required=true
error: manga-blogDBへの登録が完了していません。画像生成に進めません。RULE_VIOLATION で強制停止。
```

#### Gate 2: 親行（キャラリファレンスシート）の存在確認

```rule
name: notion_parent_row_exists
target: manga_blogdb_validation
field: parent_page_id
condition: required=true
error: manga-blogDBに親行（キャラリファレンスシート）が存在しません。画像生成・記事公開は禁止。
```

#### Gate 3: 子行の存在確認（最低1行）

```rule
name: notion_child_rows_match
target: manga_blogdb_validation
field: child_count
condition: min=1
error: manga-blogDBに子行が1つも登録されていません。Notion登録を先に完了させてください。
```

#### Gate 4: Notion未登録でのD1記事公開禁止

```rule
name: no_d1_without_notion
target: manga_publish
field: notion_registered
condition: required=true
error: Notion manga-blogDB未登録の状態でD1への記事公開は禁止されています。--no-notion使用時はarticle/ttsステップもスキップされます。
```

#### Gate 5: audio_anchors と panels の整合性チェック（D1書き込み前に必須）

**TTS音声生成後、D1に `audio_anchors` を書き込む前に以下を全て確認しろ。1つでもNGなら書き込み禁止。**

| # | チェック項目 | 正解 | やったら殺す |
|---|------------|------|------------|
| 5-1 | anchor数 = panel数 | 全パネルに対応するanchorが存在すること | パネル数とanchor数が不一致のまま書き込む |
| 5-2 | anchor.panel値 = panel_order値 | 各anchorの`panel`フィールドがD1 panelsテーブルの`panel_order`と一致すること | 0始まりと1始まりが混在した状態で書き込む |
| 5-3 | anchor.start_sec < 次のanchor.start_sec | タイムスタンプが昇順であること | 順序が逆転したanchorを書き込む |
| 5-4 | 全anchorにstart_sec値がある | start_secが0以上の数値であること | null/undefined/NaNのstart_secを含むanchorを書き込む |

```rule
name: audio_anchors_panel_consistency
target: manga_tts_d1_write
field: audio_anchors
condition: anchor_count=panel_count AND panel_values_match_panel_order AND timestamps_ascending AND all_start_sec_valid
error: audio_anchorsとpanelsの整合性チェック失敗。anchor数がpanel数と一致しない、またはpanel値がpanel_orderと不一致です。togglePlayFromPanelが冒頭から再生されるバグの原因になります。RULE_VIOLATION で強制停止。
```

**フロントエンド側の防御（実装済み）:**
- `useAudioSync` フックは `initialPanel` パラメータを受け取り、ページの初期表示位置と音声パネル位置を同期する
- `togglePlayFromPanel` は `audio.readyState < 1` の場合、`loadedmetadata` イベントを待ってからseekする（初回クリックで冒頭から再生されるバグを防止）
- これらの実装が壊れた場合、各コマクリック時に冒頭の音声が再生される致命的なUXバグとなる

#### 検証クエリ（Gate 2/3 で使用）

```bash
# manga-blogDBをslugで検索し、親行+子行の存在を確認
NOTION_TOKEN=$NOTION_API_KEY
curl -s 'https://api.notion.com/v1/databases/30bb802cb0c68032b834e0e38cb393a1/query' \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"filter":{"property":"名前","title":{"contains":"'$SLUG'"}}}' \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('results', [])
parent = [r for r in results if 'キャラリファレンスシート' in r['properties']['名前']['title'][0]['plain_text']]
children = [r for r in results if r not in parent]
print(f'parent_count={len(parent)}')
print(f'child_count={len(children)}')
if len(parent) == 0:
    print('RULE_VIOLATION: notion_parent_row_exists')
    sys.exit(1)
if len(children) == 0:
    print('RULE_VIOLATION: notion_child_rows_match')
    sys.exit(1)
print('GATE_PASS: manga-blogDB validation OK')
"
```
