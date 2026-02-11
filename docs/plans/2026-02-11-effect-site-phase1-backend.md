# effect-site Phase 1 Backend (Task 5-7.6) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 1 by adding OpenClaw skill registration, chat widget (frontend + backend), Prompt Gateway integration, and initial manga blog articles.

**Architecture:** Chat widget connects via WebSocket through Tailscale Funnel to OpenClaw Gateway (:18789) which proxies to Ollama (Qwen3 30B-A3B). Prompt Gateway injects project context via hook-inject.js. OpenClaw skill runs seo-llmo-analyzer patrol on cron. Manga articles created via manga-tools pipeline.

**Tech Stack:** React Router 7, Cloudflare Pages/D1/KV, OpenClaw Gateway, Ollama, Tailscale Funnel, Prompt Gateway (Cloudflare Worker + Notion 3DB)

---

## Task 7.5: Prompt Gateway Integration

Priority: First (enables all other tasks with proper context injection)

### Step 1: Add effect-site to hook-inject.js PROJECT_MAP

**Modify:** `~/mcp-servers/prompt-gateway/hook-inject.js`

Add to PROJECT_MAP:
```javascript
'effect-site': 'effect-site',
```

### Step 2: Create project instructions in Notion Project DB

**DB ID:** 304b802c-b0c6-8180-b1f8-defceeb79ffa

Create 4 instruction pages:

**Page 1: effect-site-overview**
- project: "effect-site"
- Content: Project overview, tech stack, domain info, GitHub repo

**Page 2: effect-site-llmo-rules**
- project: "effect-site"
- Content: Active LLMO implementation rules, no cloaking, JSON-LD spec

**Page 3: effect-site-coding-standards**
- project: "effect-site"
- Content: TypeScript strict, Cloudflare Workers constraints, ASCII-only commits, test required

**Page 4: effect-site-content-guidelines**
- project: "effect-site"
- Content: LLMO/DX article quality standards, manga illustration placement rules

### Step 3: Create task instructions in Notion Task DB

**DB ID:** 304b802c-b0c6-813a-aed4-d39c186046a8

**Page 1: article-creation**
- slug: "article-creation"
- project: "effect-site"
- Content: LLMO-optimized article creation checklist

### Step 4: Verify injection

Test with MCP tool or restart Claude Code in effect-site directory.

---

## Task 5: seo-llmo-analyzer OpenClaw Skill Registration

### Step 1: Create skill directory on VM

Via prlctl exec or shared folder:

```
~/.openclaw/workspace/skills/seo-llmo-patrol/
├── SKILL.md
├── handler.ts
└── config.json
```

### Step 2: SKILL.md

```markdown
# seo-llmo-patrol
Automated SEO/LLMO patrol for effect.moe

## Triggers
- cron: "0 6 * * *" (daily 6:00)
- keyword: "seo patrol", "llmo check"

## Actions
1. Run seo-llmo-analyzer on effect.moe
2. Compare with previous results
3. Classify issues (Critical/Warning/Improvement)
4. Send Telegram notification
```

### Step 3: handler.ts

Script that calls seo-llmo-analyzer Python tools via subprocess.

### Step 4: config.json

```json
{
  "name": "seo-llmo-patrol",
  "target_site": "https://effect.moe",
  "analyzer_path": "/Users/tonychustudio/projects/seo-llmo-analyzer",
  "telegram_chat_id": "8588084195",
  "cron": "0 6 * * *"
}
```

---

## Task 6: Chat Widget (Frontend)

### Step 1: Create chat widget component

**Create:** `app/components/chat-widget.tsx`

Floating button in bottom-right → expands to chat panel:
- Message list with user/assistant roles
- Input field with send button
- Streaming text display
- Minimize/close controls
- D1 fallback FAQ when backend unavailable

### Step 2: Create chat types

**Create:** `app/types/chat.ts`

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
```

### Step 3: Create chat API route

**Create:** `app/routes/api.chat.ts`

POST endpoint that:
- Receives user message
- If OpenClaw available → proxy to Gateway WebSocket
- If OpenClaw unavailable → return FAQ fallback from D1
- Stream response back

### Step 4: Add D1 FAQ cache table migration

**Create:** `migrations/0002_faq_cache.sql`

```sql
CREATE TABLE IF NOT EXISTS faq_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  updated_at TEXT NOT NULL
);
```

### Step 5: Add chat widget to root layout

Import and render `<ChatWidget />` in root.tsx.

### Step 6: Register API route

Add to routes.ts:
```typescript
route("api/chat", "routes/api.chat.ts"),
```

---

## Task 7: Chat Backend (OpenClaw → Ollama)

### Step 1: Create WebSocket handler in OpenClaw Gateway

The OpenClaw Gateway (:18789) needs a /chat WebSocket endpoint.

### Step 2: Create Ollama proxy

Gateway receives chat message → builds prompt with RAG context → sends to Ollama → streams response back.

### Step 3: Configure Tailscale Funnel

Expose Gateway :18789 via Tailscale Funnel for Cloudflare to reach.

### Step 4: Update chat API route

Connect effect-site's `/api/chat` to OpenClaw Gateway via Tailscale Funnel URL.

---

## Task 7.6: Initial Manga Blog Articles

### Step 1: Create 3 LLMO/DX article themes

1. "What is LLMO?" — Introduction to Large Language Model Optimization
2. "llms.txt Guide" — How to create and optimize llms.txt
3. "JSON-LD for AI" — Structured data that AI understands

### Step 2: Generate manga illustrations via manga-tools

Use manga_edit_story → manga_image_prompts → NBP generation for each article.

### Step 3: Create articles in Notion CMS

Add to the Articles database with proper metadata, manga illustrations as cover images.

---
