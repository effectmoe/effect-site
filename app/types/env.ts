export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  SITE_NAME: string;
  SITE_URL: string;
  NOTION_DATABASE_ARTICLES: string;
  NOTION_API_KEY: string;
}
