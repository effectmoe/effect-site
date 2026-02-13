-- 0007_articles_extended.sql
-- Extended articles table with manga UX fields (cluster, audio, panels)
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,                    -- Notion page ID
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,                          -- LLMO | DX | AI | Tutorial
  tags TEXT,                              -- JSON array: ["seo", "llmo"]
  published INTEGER NOT NULL DEFAULT 0,   -- boolean: 0/1
  published_at TEXT,                      -- ISO 8601 datetime
  cover_image_url TEXT,                   -- R2 URL of panel 1 image

  -- Manga UX fields
  cluster_id TEXT,                        -- FK -> clusters.id
  order_in_cluster INTEGER DEFAULT 0,     -- Display order within cluster
  global_llm_text TEXT,                   -- Rich expert text for LLMO
  audio_url TEXT,                         -- R2 URL of narration audio file
  audio_anchors TEXT,                     -- JSON: [{"panel":1,"start":0.0,"end":15.2}, ...]
  panel_count INTEGER DEFAULT 0,          -- Cached count of panels
  reading_time_seconds INTEGER DEFAULT 0, -- Audio duration in seconds

  notion_last_edited TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cluster_id) REFERENCES clusters(id)
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_cluster ON articles(cluster_id);
CREATE INDEX idx_articles_published ON articles(published, published_at);
CREATE INDEX idx_articles_cluster_order ON articles(cluster_id, order_in_cluster);
