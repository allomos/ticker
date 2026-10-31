// The app does not count requests ahead. When a data source answers that a limit is reached, it
// pauses that source for everyone, in D1: Twelve Data (8 a minute, 800 a day) until the next
// minute or UTC day; Alpha Vantage (1 a second, 25 a day) for two seconds or until the next UTC
// day. Meanwhile cached data is served and users without a cached copy are told to wait.

/** "twelvedata", "alphavantage", or a user key's own: "twelvedata:key:<hash>", "alphavantage:key:<hash>". */
export type Source = string;
const MINUTE = 60_000;
const DAY = 86_400_000;

/** At most this many symbols go in one request: a larger one could never fit a minute. */
export const MAX_BATCH = 8;

/** Seconds until the next minute starts. */
export function secondsToNextMinute(now = Date.now()): number {
  return 60 - Math.floor((now % MINUTE) / 1000);
}

/** Twelve Data's answer when a limit is reached: code 429, with "minute" or "day" in its message. */
export const isLimit = (code: number) => code === 429;

export function pauseEnd(message: string, now: number): { until: number; reason: "minute" | "day" } {
  const daily = /\bday\b|daily/i.test(message) && !/minute/i.test(message);
  return daily
    ? { until: Math.floor(now / DAY) * DAY + DAY, reason: "day" }
    : { until: Math.floor(now / MINUTE) * MINUTE + MINUTE, reason: "minute" };
}

/** Alpha Vantage's notes: "1 request per second" (burst), otherwise its 25 a day. */
export function alphaVantagePauseEnd(message: string, now: number): { until: number; reason: "second" | "day" } {
  return /per second|sparingly/i.test(message)
    ? { until: now + 2000, reason: "second" }
    : { until: Math.floor(now / DAY) * DAY + DAY, reason: "day" };
}

/** Pauses a source after a limit answer; a longer pause already in place is kept. */
export async function pause(db: D1Database, message: string, now = Date.now(), source: Source = "twelvedata"): Promise<number> {
  const { until, reason } = source.startsWith("alphavantage") ? alphaVantagePauseEnd(message, now) : pauseEnd(message, now);
  const row = await db
    .prepare(
      `INSERT INTO api_pause (source, until, reason) VALUES (?1, ?2, ?3)
       ON CONFLICT (source) DO UPDATE SET until = MAX(until, excluded.until),
         reason = CASE WHEN excluded.until > until THEN excluded.reason ELSE reason END
       RETURNING until`,
    )
    .bind(source, until, reason)
    .first<{ until: number }>();
  console.warn(`${source} limit reached (${reason}); paused until ${new Date(row!.until).toISOString()}`);
  return row!.until;
}

/** When the source may be asked again, if it is paused now; otherwise null. */
export async function pausedUntil(db: D1Database, now = Date.now(), source: Source = "twelvedata"): Promise<number | null> {
  const row = await db.prepare("SELECT until FROM api_pause WHERE source = ?1").bind(source).first<{ until: number }>();
  return row && row.until > now ? row.until : null;
}

/** Seconds to tell a user to wait: until the pause ends, or until the next minute. */
export function retryAfter(until: number | null, now = Date.now()): number {
  return until ? Math.max(1, Math.ceil((until - now) / 1000)) : secondsToNextMinute(now);
}

/** Drops cached market data nobody asked for in 30 days, and pauses that have ended. */
export async function prune(db: D1Database, now = Date.now()): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM market_cache WHERE fetched_at < ?1").bind(now - 30 * DAY),
    db.prepare("DELETE FROM api_pause WHERE until < ?1").bind(now),
  ]);
}
