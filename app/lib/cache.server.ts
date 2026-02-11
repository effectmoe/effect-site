const DEFAULT_TTL = 300; // 5 minutes

export async function cached<T>(
  kv: KVNamespace | undefined,
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  if (!kv) return fetcher();

  const hit = await kv.get(key, "json");
  if (hit) return hit as T;

  const result = await fetcher();
  await kv.put(key, JSON.stringify(result), { expirationTtl: ttl });
  return result;
}
