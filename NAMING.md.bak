# コンテンツのファイル名規則 — effect.moe

このドキュメントは `src/content/` 配下の MD/MDX ファイルの命名規則を定める。
Hermes Agent (`~/brain/scripts/web_agent.py`) と人間（Obsidian で編集する場合）の
両方が同じルールに従うこと。

## 命名規則

```
<YYYY-MM-DD>-<slug>.md
```

| 項目 | ルール |
|---|---|
| 日付プレフィックス | ISO 8601 (YYYY-MM-DD)。記事の公開日（または初稿日）|
| slug | 半角小文字＋ハイフン＋日本語可。frontmatter `title` から派生 |
| slug 長さ | 5〜50 文字目安（厳密ではないが、**100 文字を超えない**）|
| 拡張子 | `.md`（projects のみ `.mdx`）|

## slug 生成のルール

`web_agent.py` の `_slugify()` ヘルパーが単一情報源。手動で命名するときも同等に：

1. **frontmatter `title` を起点**にする（`topic` 入力ではない）
2. 大文字 → 小文字
3. プロンプトの定型句（「候補「…」をもとに記」など）は除去
4. 全角／半角の括弧・句読点・記号（`（）「」：、。×・` など）→ ハイフン
5. 連続ハイフンは 1 本にまとめ、前後ハイフンを除去
6. 50 文字で切る

例：

| 元タイトル | slug |
|---|---|
| `LLMO（LLM最適化）とは何か：定義、手法、および重要性` | `llmo-llm最適化-とは何か-定義-手法-および重要性` |
| `commandc-pwa の claude_cli モードとは？仕組みと活用方法` | `commandc-pwa-の-claude_cli-モードとは-仕組みと活用方法` |
| `AI 開発ツール移行の「見えないコスト」：設定再設計が投資対効果を左右する理由` | `ai-開発ツール移行の-見えないコスト-設定再設計が投資対効果を左右する理由` |

## してはいけないこと

- ❌ ユーザーが入力した `topic`（プロンプト）を直接 slug にしない
- ❌ 「候補「...」をもとに記」のような **生成プロンプトの断片を残さない**
- ❌ クォート文字 (`"`, `'`) を slug に含めない
- ❌ 連続するハイフン (`--`) を残さない
- ❌ slug の先頭・末尾にハイフンを置かない

## 自動化の単一情報源

| 用途 | 関数 | 場所 |
|---|---|---|
| slug 生成 | `_slugify(source, max_len)` | `~/brain/scripts/web_agent.py` |
| ファイル名生成 | `_make_filename(today, content, fallback_topic)` | 同上 |
| title 抽出 | `_extract_title_from_content(content)` | 同上 |

新しい命名ロジックを追加するときは `web_agent.py` のヘルパーを更新し、
このドキュメントの例も同期させること。

## URL との関係

Astro の `src/pages/articles/[id].astro` が `entry.id`（= ファイル名から
拡張子を除いたもの）を URL slug に使う。よって：

```
src/content/articles/2026-04-27-llmo-llm最適化-とは何か.md
                  ↓
effect.moe/articles/2026-04-27-llmo-llm最適化-とは何か/
```

ファイル名 = URL slug。**ファイル名を変えると URL も変わる**ので、公開後の
リネームは慎重に（必要なら `public/_redirects` に 301 を追加）。
