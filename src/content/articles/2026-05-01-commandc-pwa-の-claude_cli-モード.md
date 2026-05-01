---
title: commandc-pwa の claude_cli モードとは？仕組みと活用方法
description: commandc-pwa の claude_cli モードは、FastAPI バックエンドを介して Claude Code CLI をブラウザから操作可能にするモード。PWA上でClaude Codeのセッション管理・コマンド実行・リアルタイム出力を行える。
date: 2026-05-01
category: AI開発ツール
tags: [commandc-pwa, Claude Code, claude_cli, FastAPI, PWA]
draft: false
heroImage: "../../assets/articles/2026-05-01-commandc-pwa-の-claude_cli-モード.png"
---

# commandc-pwa の claude_cli モードとは？仕組みと活用方法

commandc-pwa の `claude_cli` モードは、ローカルで動作する Claude Code CLI をブラウザ（PWA）から呼び出し・制御するための実行モードである。FastAPI サーバー（port 8081）がプロセスブリッジとして機能し、WebSocket または SSE を通じてリアルタイムに CLI の標準出力をフロントエンドへストリーミングする。モバイルや外出先から自宅の Mac に接続し、Claude Code セッションを継続管理できる点が最大の特徴だ。

## claude_cli モードとは何か？

`claude_cli` モードは、commandc-pwa が対応する複数の実行バックエンドのうち、`claude` コマンド（Claude Code CLI）を直接サブプロセスとして起動・管理するモードを指す。

commandc-pwa は FastAPI + Vue.js で構成された Progressive Web App であり、バックエンドが対応する実行モードとして以下を持つ：

| モード | 説明 |
|--------|------|
| `claude_cli` | `claude` コマンドをサブプロセス実行。Claude Code のフル機能を利用 |
| `hermes` | Hermes Agent（Qwen3.6-plus）経由でタスクを委譲 |
| `opencode` | ローカル MLX モデル（port 8080）を OpenCode 経由で呼び出し |

`claude_cli` モードでは `claude -p`（print モード）または対話セッションとして Claude Code を起動し、その入出力を PWA の UI に接続する。

## claude_cli モードの仕組み

FastAPI バックエンドはリクエストを受け取ると `subprocess.Popen` または `asyncio.create_subprocess_exec` で `claude` コマンドを起動する。

```
Browser (Vue.js) → WebSocket/SSE → FastAPI (port 8081)
                                      ↓
                               subprocess: claude [args]
                                      ↓
                               stdout/stderr stream → response
```

主な処理フローは以下のとおり：

1. **セッション開始**: フロントエンドからモード `claude_cli` を指定してリクエスト
2. **プロセス起動**: FastAPI が `claude` を `--no-color` などのフラグ付きで起動
3. **ストリーミング**: stdout を chunk 単位で WebSocket に転送
4. **入力中継**: ユーザーのテキスト入力を stdin に書き込み
5. **セッション終了**: EOF または明示的なキャンセルでプロセスを終了

Tailscale VPN（MacBook Pro: 100.67.116.90）経由で外部からアクセスする場合も同様のフローで動作し、`pwa.effect.moe` ドメインから安全に利用できる。

## claude_cli モードで利用できる機能

`claude_cli` モードは Claude Code CLI の機能をほぼそのまま PWA 上で利用可能にする。

**対応している主な機能：**

- **`-p` フラグ（print モード）**: 単発の質問・タスク実行。非対話型なのでモバイルからの素早い指示に最適
- **スラッシュコマンド**: `/review`・`/ultrareview`・`/schedule` などの Claude Code スキルをブラウザから呼び出し
- **MCP 連携**: `~/.claude/mcp.json` に定義された 6 本の MCP サーバー（brain-knowledge / hermes / google-analytics 等）を claude_cli 越しに利用
- **ファイル操作**: FastAPI サーバーが動作する MacBook Pro のファイルシステムへのアクセス
- **セッション継続**: セッション ID を保持することで、中断した Claude Code セッションを再接続

## commandc-pwa と他モードとの使い分け

`claude_cli` モードは Claude Code の全機能を使える反面、Claude API のトークンコストが発生する。用途に応じて以下の基準で使い分けることが推奨される：

| ユースケース | 推奨モード |
|-------------|-----------|
| コーディング・ファイル編集・ツール呼び出し | `claude_cli` |
| 長文生成・要約・翻訳（コスト重視） | `opencode`（MLX ローカルモデル） |
| 自律タスク委譲・非同期処理 | `hermes` |
| 実験的・高速な単発クエリ | `claude_cli -p` |

effect.moe の自律コンテンツパイプラインでは `web_agent.py rewrite` ステップにおいて Hermes（Qwen3.6-plus）を使用し、最終レビュー・承認フローのみ `claude_cli` を通じて Claude Code に委ねる設計を採用している。

## セキュリティと認証

`pwa.effect.moe` は Tailscale 接続または Cloudflare Access による認証（OTP メール: kangmyung.j@gmail.com）で保護されており、無認証での claude_cli モードへのアクセスは不可能である。

FastAPI バックエンドはさらに以下のセキュリティ制御を実施している：

- **プロセス分離**: 各セッションは独立したサブプロセスとして起動し、クロスセッション汚染を防止
- **タイムアウト制御**: 長時間実行プロセスのハングアップを防ぐ最大実行時間の設定
- **入力サニタイズ**: stdin へ渡す文字列のシェルインジェクション対策

## まとめ

- `claude_cli` モードは commandc-pwa において Claude Code CLI をブラウザ・モバイルから操作するための実行バックエンド
- FastAPI（port 8081）がサブプロセスブリッジとして `claude` コマンドを起動し、WebSocket/SSE でリアルタイムストリーミング
- MCP 連携・スラッシュコマンド・セッション継続など Claude Code のフル機能を PWA 上で利用可能
- `hermes`（Qwen3.6-plus）や `opencode`（MLX ローカル）と組み合わせてコスト最適化が可能
- Tailscale VPN + Cloudflare Access による多層認証でセキュアに運用