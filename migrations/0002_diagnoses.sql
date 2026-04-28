CREATE TABLE IF NOT EXISTS diagnoses (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  domain      TEXT NOT NULL,
  score       INTEGER NOT NULL,
  grade       TEXT NOT NULL,
  result_json TEXT NOT NULL,
  email       TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_domain     ON diagnoses(domain);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON diagnoses(created_at);
