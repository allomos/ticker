// The Twelve Data free plan allows 8 requests a minute and 800 a day, one per symbol.
// Every request the app sends first reserves its credits here, in D1, so all users and
// Worker instances share one budget. One credit a minute is kept spare.

export const MINUTE_LIMIT = 7;
export const DAY_LIMIT = 780;

function windows(now: number) {
  const iso = new Date(now).toISOString();
  return { minute: `m:${iso.slice(0, 16)}`, day: `d:${iso.slice(0, 10)}` };
}

/** Seconds until the next minute window opens. */
export function secondsToNextMinute(now = Date.now()): number {
  return 60 - Math.floor((now % 60_000) / 1000);
}

const RESERVE = `INSERT INTO api_budget (slot, used) VALUES (?1, ?2)
  ON CONFLICT (slot) DO UPDATE SET used = used + ?2 WHERE used + ?2 <= ?3
  RETURNING used`;

/** Reserves exactly `n` credits, or none. */
export async function reserve(db: D1Database, n: number, now = Date.now()): Promise<boolean> {
  if (n <= 0) return true;
  if (n > MINUTE_LIMIT) return false;
  const { minute, day } = windows(now);
  const m = await db.prepare(RESERVE).bind(minute, n, MINUTE_LIMIT).first();
  if (!m) return false;
  const d = await db.prepare(RESERVE).bind(day, n, DAY_LIMIT).first();
  if (!d) {
    await db.prepare("UPDATE api_budget SET used = used - ?2 WHERE slot = ?1").bind(minute, n).run();
    return false;
  }
  return true;
}

/** Credits left now: the smaller of this minute's and today's. */
export async function remaining(db: D1Database, now = Date.now()): Promise<number> {
  const { minute, day } = windows(now);
  const rows = await db
    .prepare("SELECT slot, used FROM api_budget WHERE slot IN (?1, ?2)")
    .bind(minute, day)
    .all<{ slot: string; used: number }>();
  const used = (w: string) => rows.results.find((r) => r.slot === w)?.used ?? 0;
  return Math.max(0, Math.min(MINUTE_LIMIT - used(minute), DAY_LIMIT - used(day)));
}

/** Reserves as many credits as it can, up to `want`; returns how many. */
export async function reserveUpTo(db: D1Database, want: number, now = Date.now()): Promise<number> {
  let n = Math.min(want, await remaining(db, now));
  while (n > 0) {
    if (await reserve(db, n, now)) return n;
    n--;
  }
  return 0;
}

/** Drops minute windows older than an hour, day windows older than a week, and cached market
 * data nobody asked for in 30 days. */
export async function prune(db: D1Database, now = Date.now()): Promise<void> {
  const hourAgo = windows(now - 3_600_000).minute;
  const weekAgo = windows(now - 7 * 86_400_000).day;
  await db.batch([
    db.prepare("DELETE FROM api_budget WHERE slot LIKE 'm:%' AND slot < ?1").bind(hourAgo),
    db.prepare("DELETE FROM api_budget WHERE slot LIKE 'd:%' AND slot < ?1").bind(weekAgo),
    db.prepare("DELETE FROM market_cache WHERE fetched_at < ?1").bind(now - 30 * 86_400_000),
  ]);
}
