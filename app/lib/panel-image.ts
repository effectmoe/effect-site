/**
 * Append ?v={timestamp} to a panel image URL for cache busting.
 * Uses synced_at from the panels table so browsers refetch after image replacement.
 * Shared module (not .server.ts) so it can be used in client components.
 */
export function panelImageUrl(panel: {
  image_url: string;
  synced_at: string | null;
}): string {
  if (!panel.synced_at) return panel.image_url;
  const ts = new Date(panel.synced_at).getTime();
  if (isNaN(ts)) return panel.image_url;
  const sep = panel.image_url.includes("?") ? "&" : "?";
  return `${panel.image_url}${sep}v=${ts}`;
}
