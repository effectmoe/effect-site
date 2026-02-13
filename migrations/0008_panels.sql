-- 0008_panels.sql
-- Manga panels: per-panel image, transcript, and AI context
CREATE TABLE IF NOT EXISTS panels (
  id TEXT PRIMARY KEY,                    -- Notion page ID
  article_id TEXT NOT NULL,               -- FK -> articles.id
  panel_order INTEGER NOT NULL,           -- 1-based display order
  image_url TEXT NOT NULL,                -- R2 URL
  image_width INTEGER,
  image_height INTEGER,
  transcript TEXT,                        -- Speech bubble text (searchable)
  ai_context TEXT,                        -- Scene description for LLMO
  notion_last_edited TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id),
  UNIQUE(article_id, panel_order)
);

CREATE INDEX idx_panels_article ON panels(article_id);
CREATE INDEX idx_panels_order ON panels(article_id, panel_order);
