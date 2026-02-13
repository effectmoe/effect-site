-- Seed dummy data for local testing
-- Run: npx wrangler d1 execute effect-site-db --local --file=scripts/seed-dummy.sql

-- Clean existing data
DELETE FROM panels;
DELETE FROM articles;
DELETE FROM clusters;

-- Clusters (2 series)
INSERT INTO clusters (id, name, slug, description, pillar_article_id, status, sort_order, synced_at)
VALUES
  ('cluster-llmo-101', 'LLMO Fundamentals', 'llmo-fundamentals', 'Learn LLMO from zero to hero in manga format', NULL, 'active', 1, datetime('now')),
  ('cluster-dx-tools', 'DX Tools Review', 'dx-tools-review', 'Developer experience tools reviewed as manga', NULL, 'active', 2, datetime('now'));

-- Articles (6 total: 3 in cluster 1, 2 in cluster 2, 1 standalone)
INSERT INTO articles (id, title, slug, description, category, tags, published, published_at, cover_image_url, cluster_id, order_in_cluster, global_llm_text, audio_url, audio_anchors, panel_count, reading_time_seconds, synced_at)
VALUES
  -- LLMO Fundamentals series
  ('art-llmo-01', 'What is LLMO?', 'what-is-llmo', 'Introduction to Large Language Model Optimization for web marketing', 'LLMO', '["llmo","seo","ai"]', 1, '2026-01-15T10:00:00Z', 'https://placehold.co/800x1100/1a1a1a/white?text=LLMO+01', 'cluster-llmo-101', 1, 'LLMO (Large Language Model Optimization) is the practice of optimizing web content for AI-powered search engines and chatbots. Unlike traditional SEO which targets keyword algorithms, LLMO focuses on making content easily parseable by large language models like GPT, Claude, and Gemini.', 'https://example.com/audio/llmo-01.mp3', '[{"panel":1,"start":0,"end":8},{"panel":2,"start":8,"end":16},{"panel":3,"start":16,"end":25},{"panel":4,"start":25,"end":35}]', 4, 35, datetime('now')),

  ('art-llmo-02', 'JSON-LD for AI', 'json-ld-for-ai', 'How structured data helps AI crawlers understand your content', 'LLMO', '["json-ld","schema","structured-data"]', 1, '2026-01-22T10:00:00Z', 'https://placehold.co/800x1100/1a1a1a/white?text=LLMO+02', 'cluster-llmo-101', 2, 'JSON-LD (JavaScript Object Notation for Linked Data) is the recommended format by Google for structured data. Using @graph format with @id references creates a knowledge graph that AI systems can traverse. Schema.org types like Article, ComicIssue, and BreadcrumbList help AI understand page context.', NULL, NULL, 3, 0, datetime('now')),

  ('art-llmo-03', 'llms.txt Specification', 'llms-txt-spec', 'The emerging standard for AI-readable site summaries', 'LLMO', '["llms-txt","robots","ai-crawlers"]', 1, '2026-02-01T10:00:00Z', 'https://placehold.co/800x1100/1a1a1a/white?text=LLMO+03', 'cluster-llmo-101', 3, 'llms.txt is an emerging web standard that provides AI-readable summaries of website content. Similar to robots.txt for crawlers, llms.txt tells AI systems what a site is about, what pages exist, and how content is organized. It supports markdown formatting with sections, links, and descriptions.', NULL, NULL, 3, 0, datetime('now')),

  -- DX Tools Review series
  ('art-dx-01', 'Cloudflare Workers Deep Dive', 'cloudflare-workers-deep-dive', 'Why Cloudflare Workers is the ultimate DX for edge computing', 'DX', '["cloudflare","workers","edge"]', 1, '2026-01-20T10:00:00Z', 'https://placehold.co/800x1100/171717/white?text=DX+01', 'cluster-dx-tools', 1, 'Cloudflare Workers provide a serverless execution environment at the edge. With D1 (SQLite), KV (key-value store), R2 (object storage), and Workers AI, developers can build full-stack applications that run close to users worldwide.', NULL, NULL, 3, 0, datetime('now')),

  ('art-dx-02', 'React Router 7 on Edge', 'react-router-7-edge', 'Server-side rendering at the edge with React Router 7', 'DX', '["react-router","ssr","edge"]', 1, '2026-02-05T10:00:00Z', 'https://placehold.co/800x1100/171717/white?text=DX+02', 'cluster-dx-tools', 2, 'React Router 7 brings framework-level features to React applications. When deployed on Cloudflare Workers, it enables SSR at the edge with sub-50ms TTFB. The loader/action pattern provides clean server/client separation.', NULL, NULL, 3, 0, datetime('now')),

  -- Standalone article (no cluster)
  ('art-standalone', 'AI Crawler Landscape 2026', 'ai-crawler-landscape-2026', 'A comprehensive look at AI crawlers visiting your site', 'AI', '["ai","crawlers","analytics"]', 1, '2026-02-10T10:00:00Z', 'https://placehold.co/800x1100/333/white?text=AI+Crawlers', NULL, 0, 'In 2026, over 20 distinct AI crawlers regularly visit websites. GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended, and PerplexityBot are the most active. Understanding their behavior is crucial for LLMO strategy.', NULL, NULL, 0, 0, datetime('now'));

-- Panels for art-llmo-01 (4 panels with audio anchors)
INSERT INTO panels (id, article_id, panel_order, image_url, image_width, image_height, transcript, ai_context, synced_at)
VALUES
  ('panel-llmo01-1', 'art-llmo-01', 1, 'https://placehold.co/800x1100/1a1a1a/white?text=Panel+1', 800, 1100, 'Professor: Today we learn about LLMO - Large Language Model Optimization!', 'A professor character stands in front of a whiteboard with LLMO written on it.', datetime('now')),
  ('panel-llmo01-2', 'art-llmo-01', 2, 'https://placehold.co/800x1100/222/white?text=Panel+2', 800, 1100, 'Student: How is it different from SEO? Professor: SEO targets search algorithms. LLMO targets AI language models directly.', 'Student asking question, professor explaining with comparison diagram.', datetime('now')),
  ('panel-llmo01-3', 'art-llmo-01', 3, 'https://placehold.co/800x1100/333/white?text=Panel+3', 800, 1100, 'Professor: The key techniques are JSON-LD structured data, llms.txt, and semantic HTML. Student: So we help AI understand our content!', 'Professor showing three pillars diagram of LLMO techniques.', datetime('now')),
  ('panel-llmo01-4', 'art-llmo-01', 4, 'https://placehold.co/800x1100/444/white?text=Panel+4', 800, 1100, 'Both: Never serve different content to AI crawlers vs humans! That is cloaking! Next time: JSON-LD deep dive!', 'Both characters pointing at a warning sign about cloaking.', datetime('now'));

-- Panels for art-llmo-02 (3 panels)
INSERT INTO panels (id, article_id, panel_order, image_url, image_width, image_height, transcript, ai_context, synced_at)
VALUES
  ('panel-llmo02-1', 'art-llmo-02', 1, 'https://placehold.co/800x1100/1a1a1a/white?text=JSON-LD+1', 800, 1100, 'Professor: JSON-LD uses @context and @graph to create a knowledge graph for your page.', 'Professor showing JSON code on screen.', datetime('now')),
  ('panel-llmo02-2', 'art-llmo-02', 2, 'https://placehold.co/800x1100/222/white?text=JSON-LD+2', 800, 1100, 'Student: So ComicIssue type tells AI this is a manga? Professor: Exactly! And ComicSeries links them all together.', 'Diagram showing schema.org type hierarchy.', datetime('now')),
  ('panel-llmo02-3', 'art-llmo-02', 3, 'https://placehold.co/800x1100/333/white?text=JSON-LD+3', 800, 1100, 'Professor: Always use @id references to connect entities. This creates a rich knowledge graph. Student: Got it!', 'Knowledge graph visualization with connected nodes.', datetime('now'));

-- Panels for art-llmo-03 (3 panels)
INSERT INTO panels (id, article_id, panel_order, image_url, image_width, image_height, transcript, ai_context, synced_at)
VALUES
  ('panel-llmo03-1', 'art-llmo-03', 1, 'https://placehold.co/800x1100/1a1a1a/white?text=llms.txt+1', 800, 1100, 'Professor: llms.txt is like robots.txt but for AI! It tells language models about your site.', 'Professor holding a document labeled llms.txt.', datetime('now')),
  ('panel-llmo03-2', 'art-llmo-03', 2, 'https://placehold.co/800x1100/222/white?text=llms.txt+2', 800, 1100, 'Student: What format does it use? Professor: Markdown! With sections for pages, articles, and metadata.', 'Screen showing markdown formatted llms.txt file.', datetime('now')),
  ('panel-llmo03-3', 'art-llmo-03', 3, 'https://placehold.co/800x1100/333/white?text=llms.txt+3', 800, 1100, 'Professor: Group by series and include transcripts for manga. This helps AI cite your content! Student: Amazing!', 'Example llms.txt output with highlighted sections.', datetime('now'));

-- Panels for art-dx-01 (3 panels)
INSERT INTO panels (id, article_id, panel_order, image_url, image_width, image_height, transcript, ai_context, synced_at)
VALUES
  ('panel-dx01-1', 'art-dx-01', 1, 'https://placehold.co/800x1100/171717/white?text=CF+Workers+1', 800, 1100, 'Dev: Cloudflare Workers run JavaScript at 300+ edge locations worldwide!', 'Developer character with world map showing edge nodes.', datetime('now')),
  ('panel-dx01-2', 'art-dx-01', 2, 'https://placehold.co/800x1100/222/white?text=CF+Workers+2', 800, 1100, 'Dev: With D1, KV, R2, and Workers AI, you get a full stack at the edge. No origin server needed!', 'Architecture diagram showing D1, KV, R2, AI bindings.', datetime('now')),
  ('panel-dx01-3', 'art-dx-01', 3, 'https://placehold.co/800x1100/333/white?text=CF+Workers+3', 800, 1100, 'Dev: Sub-50ms TTFB globally. That is the power of edge computing!', 'Performance graph showing latency comparison.', datetime('now'));

-- Panels for art-dx-02 (3 panels)
INSERT INTO panels (id, article_id, panel_order, image_url, image_width, image_height, transcript, ai_context, synced_at)
VALUES
  ('panel-dx02-1', 'art-dx-02', 1, 'https://placehold.co/800x1100/171717/white?text=RR7+1', 800, 1100, 'Dev: React Router 7 brings loaders and actions for clean server/client separation.', 'Code editor showing loader function.', datetime('now')),
  ('panel-dx02-2', 'art-dx-02', 2, 'https://placehold.co/800x1100/222/white?text=RR7+2', 800, 1100, 'Dev: Deploy on Cloudflare Workers for SSR at the edge. The Vite plugin handles everything!', 'Deploy pipeline diagram.', datetime('now')),
  ('panel-dx02-3', 'art-dx-02', 3, 'https://placehold.co/800x1100/333/white?text=RR7+3', 800, 1100, 'Dev: Streaming SSR, code splitting, and prefetching out of the box. This is the future of React!', 'Browser showing fast page load waterfall.', datetime('now'));
