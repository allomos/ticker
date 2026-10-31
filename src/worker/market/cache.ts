// Market data shared by all users, kept in D1 so every Worker instance sees the same copy.

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

export async function cacheGet<T>(db: D1Database, key: string): Promise<CacheEntry<T> | null> {
  const row = await db
    .prepare("SELECT value, fetched_at FROM market_cache WHERE key = ?1")
    .bind(key)
    .first<{ value: string; fetched_at: number }>();
  return row ? { value: JSON.parse(row.value) as T, fetchedAt: row.fetched_at } : null;
}

export async function cacheGetMany<T>(db: D1Database, keys: string[]): Promise<Map<string, CacheEntry<T>>> {
  const out = new Map<string, CacheEntry<T>>();
  for (let i = 0; i < keys.length; i += 90) {
    const chunk = keys.slice(i, i + 90);
    const rows = await db
      .prepare(`SELECT key, value, fetched_at FROM market_cache WHERE key IN (${chunk.map(() => "?").join(",")})`)
      .bind(...chunk)
      .all<{ key: string; value: string; fetched_at: number }>();
    for (const r of rows.results) out.set(r.key, { value: JSON.parse(r.value) as T, fetchedAt: r.fetched_at });
  }
  return out;
}

export async function cachePut(db: D1Database, key: string, value: unknown, now = Date.now()): Promise<void> {
  await db
    .prepare(
      `INSERT INTO market_cache (key, value, fetched_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at`,
    )
    .bind(key, JSON.stringify(value), now)
    .run();
}
