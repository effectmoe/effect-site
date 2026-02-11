-- Patrol results table for SEO/LLMO monitoring
CREATE TABLE IF NOT EXISTS patrol_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL DEFAULT 'daily',
  timestamp TEXT NOT NULL,
  pages_ok INTEGER NOT NULL DEFAULT 0,
  pages_total INTEGER NOT NULL DEFAULT 0,
  endpoints_ok INTEGER NOT NULL DEFAULT 0,
  endpoints_total INTEGER NOT NULL DEFAULT 0,
  issues_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  full_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patrol_results_mode ON patrol_results(mode);
CREATE INDEX IF NOT EXISTS idx_patrol_results_timestamp ON patrol_results(timestamp);
