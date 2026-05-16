# 04 — Visual Principles

> デザインの原則・視覚言語・参照を固定するファイル。
> 装飾のための装飾は禁止。すべて「AI に強いエンジニア集団」のブランドを支える要素であること。

---

## Design DNA — "文字でできた地球"

このサイトの意匠の核は、**ヒーローのドットマトリクス地球**にある:

- 地球は CG ではなく、文字（`·` `.` `+` `#` `@`）で構成されている
- 文字が並んで世界を表現する → **言語で世界を記述するエンジニアリングの象徴**
- 黒背景に白〜緑の文字で淡々と回転する
- 経度表示が `LON 234.5°` の等幅で右下に出る

この「**文字とコードで世界を捉える**」アティテュードを、サイト全体に拡張する。

## Visual Principles（鉄則）

### 1. タイポグラフィを意匠にする
- 装飾画像より、**フォントの組み合わせ**で世界観を作る
- 見出し: ディスプレイ系（既存の Clash Display）
- 本文: 読みやすい sans-serif
- メタ情報・座標・コード断片: **等幅フォント**（既存の font-mono）
- 等幅フォントは「engineering aesthetic」の象徴として多用する

### 2. 配色は極小
- ベース: 黒 (`#0a0a0a` 系) と白 (`#fafafa` 系)
- アクセント: **1色のみ**（既存サイトの緑系を維持。例: `#00ff88` 系のターミナルグリーン）
- グレー: 階調表現のため数段階
- 多色を使わない。情報は形と余白で表現する

### 3. 動きは「意味のある場面」だけ
- 入場アニメ: Hero と記事カードだけ
- ホバー時の微細な反応: ボタンとカード
- 過剰な scroll アニメは禁止（既存の Lenis は再評価対象）
- Globe の回転は永続（サイトのアイデンティティ）

### 4. 装飾は「コード／ターミナル風」に寄せる
- 引用やコールアウトは `>` プレフィックスや `$ command` 形式
- 区切り線より `─────` のような ASCII 線
- 番号付きリストは `[01]` `[02]` のような角括弧表現
- 強調は色ではなく `[キーワード]` の角括弧表現も併用

### 5. 余白は広く取る
- 情報密度を上げない
- 1スクリーンに伝えたいことは1つ
- パディングはモバイル `py-12`、デスクトップ `py-24` を基準

## Typography Stack

```css
/* 既存 Tailwind config + 追加 */
font-clash    /* 見出し（Clash Display） */
font-sans     /* 本文 */
font-mono     /* メタ情報・座標・コード（JetBrains Mono など） */
```

階層:
- H1: `clamp(2rem, 5.5vw, 6rem)` / font-clash / leading-tight
- H2: `clamp(1.75rem, 3vw, 3rem)` / font-clash
- H3: `text-xl lg:text-2xl` / font-sans / semibold
- Body: `text-base lg:text-[1.0625rem]` / font-sans / leading-relaxed
- Meta: `text-xs lg:text-sm` / font-mono / tracking-[0.14em]

## Color Tokens（提案）

```css
--bg-base:       #0a0a0a;   /* 純粋な黒ではなく、わずかに温かい黒 */
--bg-surface:    #141414;   /* カード等の背景 */
--bg-elevated:   #1a1a1a;   /* hover や強調 */

--text-primary:  #fafafa;   /* 主テキスト */
--text-secondary:#a1a1aa;   /* 補助テキスト */
--text-muted:    #71717a;   /* メタ情報 */

--accent:        #00ff88;   /* ターミナルグリーン（既存色を踏襲） */
--accent-dim:    #00cc6a;

--border:        #27272a;
--border-strong: #3f3f46;
```

※ 実際の既存サイトの色味と摺り合わせて確定する。

## Iconography

- 線画アイコンのみ（塗りつぶし不可）
- 太さ統一（1.5px 推奨）
- `astro-icon` で SVG を扱う
- 装飾的な絵文字は使わない

## Imagery

- 写真はほぼ使わない。使うとしてもグレースケール処理
- 画像より **コード断片・図表・グラフ** を優先
- 抽象的な「ビジネス画像」は禁止（ストックフォト感）

## Component Patterns

### Card（記事・事例）
```
[meta line - mono]                          [arrow icon]
─────────────────────────────────────────
TITLE in clash display
Description in sans, max 2 lines
─────────────────────────────────────────
[ category ]  [ tag ]  [ tag ]
```

### Button
- Primary: 黒地に白テキスト（または逆）+ ホバーでアクセント色のボーダー
- Secondary: ボーダーのみ、ホバーで埋まる
- 余計なグラデーション・シャドウは禁止

### Section Header
```
[ 02 ] LATEST KNOWLEDGE
─────────────────────────
H2 でディスプレイフォント
```
番号は `[ 02 ]` 形式、セクション名は等幅で uppercase、その下に Clash Display で大きく見出し。

## References（インスピレーション）

- **Linear** (linear.app): 余白・タイポの抜け感
- **Vercel** (vercel.com): 黒背景の中での緑アクセント
- **Stripe Docs** (stripe.com/docs): 情報密度の高い読みやすさ
- **Anthropic** (anthropic.com): 静かな知性
- **Replicate** (replicate.com): モノスペースの使い方
- **Obsidian** (obsidian.md): 文字主体の意匠
- **既存 effect.moe Hero**: Globe + 等幅文字 — このサイトの DNA

## Anti-patterns（やってはいけない表現）

- グラスモーフィズム / ニューモーフィズム
- グラデーションの多用（特に紫→ピンク系の "AI 風" グラデ）
- 浮遊する 3D オブジェクト
- パララックスの全画面演出
- 「テクノロジー感」を出すためのワイヤーフレーム背景
- 過剰なローディングアニメ
- ヒーロー動画
- ポップアップ（クッキー同意以外）

これらは「AI に詳しくない会社が AI を表現しようとした」ときに頻発する記号。effect.moe はそれらを避ける。
