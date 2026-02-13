-- 0006_clusters.sql
-- Topic clusters for grouping manga articles into series/topics
CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,                    -- Notion page ID (UUID without hyphens)
  name TEXT NOT NULL,                     -- Cluster display name
  slug TEXT NOT NULL UNIQUE,              -- URL slug for /clusters/:slug
  description TEXT,                       -- AI-readable topic description
  pillar_article_id TEXT,                 -- FK -> articles.id (nullable until pillar assigned)
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | active | complete
  sort_order INTEGER NOT NULL DEFAULT 0,  -- Manual ordering on grid
  notion_last_edited TEXT,                -- Notion lastEditedTime for sync diffing
  synced_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_clusters_slug ON clusters(slug);
CREATE INDEX idx_clusters_status ON clusters(status);
