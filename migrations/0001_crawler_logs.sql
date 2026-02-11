CREATE TABLE IF NOT EXISTS crawler_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawler_name TEXT NOT NULL,
  company TEXT NOT NULL,
  path TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX idx_crawler_logs_timestamp ON crawler_logs(timestamp);
CREATE INDEX idx_crawler_logs_company ON crawler_logs(company);
