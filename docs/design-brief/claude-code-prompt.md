# Claude Code への着手プロンプト

> このファイルをそのままコピペして Claude Code に投げる。
> Claude Code は最初に必読ファイルを全部読んでから着手すること。

---

## あなたの役割

あなたは effect.moe の **トップページとコンテンツ構造の再設計・実装** を担当するエンジニアです。
既存実装を尊重しつつ、design-brief に沿ってサイトを進化させてください。

## 必読ファイル（着手前に必ず全部読む）

順番に読むこと:

1. `docs/design-brief/01-mission-and-audience.md` — サイトの目的
2. `docs/design-brief/02-information-architecture.md` — ページ構造
3. `docs/design-brief/03-top-page-spec.md` — トップページ仕様
4. `docs/design-brief/04-visual-principles.md` — 視覚原則
5. `docs/design-brief/05-tech-constraints.md` — 技術制約
6. `docs/design-brief/06-content-pipeline.md` — コンテンツの3層構造

その後、以下の既存実装を確認:

- `src/pages/index.astro` — 現状トップ
- `src/components/sections/home/` — 既存セクション群
- `src/components/sections/home/hero/GlobeHeroSplit.astro` — Globe Hero（**保持必須**）
- `src/components/sections/home/hero/globe.ts` — Globe 描画ロジック
- `functions/api/*.ts` — 既存 API（**インターフェース維持必須**）

## ゴール

1. **コンテンツの一元化**: `src/effect-web/{articles,blogs,knowledge}` を `src/content/posts/` に統合
2. **Thino collection の新設**: `src/content/thinos/YYYY-MM-DD.md` を読み込む collection を追加
3. **トップページ再設計**: 03-top-page-spec.md に従って `src/pages/index.astro` を再構築
4. **`/thinos` ページ新設**: タイムライン形式で `#public` Thino を表示
5. **`/posts` 統合ページ**: 旧 articles/blogs/knowledge を統合した一覧
6. **旧 URL リダイレクト**: `public/_redirects` で 301
7. **構造化データ追加**: トップ・記事・診断ページに JSON-LD

## 厳守事項

### 絶対に変えてはいけないもの
- `src/components/sections/home/hero/globe.ts` の Globe 描画ロジック
- `GlobeHeroSplit.astro` の地球の見え方（DNA）
- `functions/api/*` の入出力インターフェース
- 既存の i18n キー（`src/lib/utils.ts` の `t()` 経由）

### 削除して良いもの
- `src/pages/index.astro.bak`
- 未使用になった旧フォルダ（移行完了後）
- `lenis`（再評価対象 — チームで決定後）

### 視覚的な制約
- 黒背景 + 白文字 + アクセント1色（既存の緑系を踏襲）
- 等幅フォントを意匠として多用
- 過剰なグラデ・3D・パララックスを使わない
- 04-visual-principles.md の Anti-patterns を必ず避ける

## 進め方（段階）

### Phase A — 仕様確認とワイヤーフレーム提案
1. 必読ファイルをすべて読む
2. 既存実装を全件確認
3. **不明点をユーザーに質問する**（必要なら）
4. 新しいトップページのワイヤーフレームを **ASCII で提案**
5. ユーザーの承認を得る

### Phase B — コンテンツ構造の移行
1. `src/content.config.ts` を更新（posts / thinos / cases / legals collection 定義）
2. 既存記事を `src/content/posts/` に物理移動（git mv 推奨）
3. frontmatter を新スキーマに合わせて変換（必要なら一括スクリプト）
4. `src/pages/` 配下のルーティングを更新
5. `public/_redirects` に 301 を追加
6. ローカルで `pnpm dev` 起動、全ページ表示確認

### Phase C — トップページの再構築
1. `src/pages/index.astro` を 03-top-page-spec の順序に組み直す
2. 各セクションコンポーネントを 04-visual-principles に沿って調整
3. `Latest Thinos` セクションを新設
4. 構造化データの JSON-LD を追加
5. Lighthouse 計測、90+ を確認

### Phase D — 仕上げ
1. `/posts` `/thinos` `/cases` の一覧ページを実装
2. アクセシビリティ検証（axe / Lighthouse）
3. モバイル・タブレット・デスクトップでスクリーンショット確認
4. ユーザーに完成報告 + 確認依頼

## 質問してから着手すべき項目

以下が不明な場合、推測せず必ず質問:

- アクセントカラーの正確な色コード（既存の緑系の hex）
- Thino のサイト公開タグの正式名称（`#public` で良いか）
- 既存記事の frontmatter で残すべきフィールド
- 既存の i18n キー（特に新セクション用のキー追加が必要な場合）
- `lenis` を削除して良いか

## アウトプット形式

各 Phase の完了時:

```
## Phase X 完了報告

### 変更したファイル
- path/to/file.astro (新規)
- path/to/another.ts (修正)

### 確認方法
- pnpm dev で起動
- http://localhost:4321/ を開く
- 確認ポイント:
  1. ...
  2. ...

### スクリーンショット
（Playwright MCP でキャプチャした画像、または手元で確認）

### 次の Phase に進む前の確認事項
- ...
```

## 困ったときの判断基準

迷ったら以下の優先順位で:

1. **ユーザー（事業オーナー）の意図**: design-brief に沿う
2. **既存の動作**: 壊さない
3. **パフォーマンス**: 速い方を選ぶ
4. **アクセシビリティ**: 全員に届く方を選ぶ
5. **コードのシンプルさ**: 抽象化より直接性
6. **将来の保守性**: 自分が来週読んで分かるか

## 開始の一言

このプロンプトを読んだら、最初に必読ファイル6つを順番に読み、`src/pages/index.astro` と関連コンポーネントを確認した上で、**Phase A のワイヤーフレーム提案** をユーザーに提示してください。

実装には Phase A の承認後に着手すること。
