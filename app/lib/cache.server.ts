const DEFAULT_TTL = 3600; // 1 hour

/**
 * KV cache with stale-while-revalidate pattern.
 * - Returns cached data immediately (even if stale)
 * - Refreshes in background when soft TTL expires
 * - Hard TTL handled by KV expiration
 */
export async function cached<T>(
  kv: KVNamespace | undefined,
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  if (!kv) return fetcher();

  // Try KV cache first (includes metadata for soft TTL)
  const { value, metadata } = await kv.getWithMetadata<T, { storedAt: number }>(key, "json");

  if (value !== null) {
    // Check soft TTL (5 min) - if expired, revalidate in background
    const softTtl = 300_000; // 5 minutes in ms
    const age = Date.now() - (metadata?.storedAt ?? 0);
    if (age > softTtl) {
      // Stale - return cached data but refresh in background
      void revalidate(kv, key, fetcher, ttl);
    }
    return value;
  }

  // Cache miss - fetch synchronously
  const result = await fetcher();
  await kv.put(key, JSON.stringify(result), {
    expirationTtl: ttl,
    metadata: { storedAt: Date.now() },
  });
  return result;
}

async function revalidate<T>(
  kv: KVNamespace,
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
): Promise<void> {
  try {
    const result = await fetcher();
    await kv.put(key, JSON.stringify(result), {
      expirationTtl: ttl,
      metadata: { storedAt: Date.now() },
    });
  } catch {
    // Revalidation failed - stale data continues to be served
  }
}
