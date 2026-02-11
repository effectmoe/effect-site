-- Article chunks for RAG (Retrieval-Augmented Generation)
-- Stores article text chunks with embedding vectors for semantic search

CREATE TABLE IF NOT EXISTS article_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  article_title TEXT NOT NULL,
  article_slug TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding TEXT,  -- JSON array of floats (768 dimensions for bge-base-en-v1.5)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(article_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_article_chunks_article ON article_chunks(article_id);
CREATE INDEX IF NOT EXISTS idx_article_chunks_slug ON article_chunks(article_slug);
