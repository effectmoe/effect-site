/**
 * Extend Cloudflare Env with secrets (not in wrangler.toml).
 * These are set via `wrangler secret put`.
 */
declare namespace Cloudflare {
  interface Env {
    ADMIN_API_KEY: string;
    NOTION_API_KEY: string;
  }
}
