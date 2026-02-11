-- GA4 daily metrics
CREATE TABLE IF NOT EXISTS ga4_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  page_path TEXT NOT NULL DEFAULT '/',
  pageviews INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  avg_session_duration REAL NOT NULL DEFAULT 0,
  bounce_rate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, page_path)
);

-- GSC daily metrics
CREATE TABLE IF NOT EXISTS gsc_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  page TEXT NOT NULL DEFAULT '/',
  query TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, page, query)
);

CREATE INDEX IF NOT EXISTS idx_ga4_daily_date ON ga4_daily(date);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_date ON gsc_daily(date);
