// The free Twelve Data plan allows 8 requests a minute and 800 a day for the whole app. The app
// does not count ahead: when Twelve Data answers that a limit is reached (429), it pauses Twelve
// Data for everyone, in D1, until the next minute or, for the daily limit, the next UTC day.
// Meanwhile cached data is served and users without a cached copy are told to wait.

const SOURCE = "twelvedata";
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

/** Pauses Twelve Data after a limit answer; a longer pause already in place is kept. */
export async function pause(db: D1Database, message: string, now = Date.now()): Promise<number> {
  const { until, reason } = pauseEnd(message, now);
  const row = await db
    .prepare(
      `INSERT INTO api_pause (source, until, reason) VALUES (?1, ?2, ?3)
       ON CONFLICT (source) DO UPDATE SET until = MAX(until, excluded.until),
         reason = CASE WHEN excluded.until > until THEN excluded.reason ELSE reason END
       RETURNING until`,
    )
    .bind(SOURCE, until, reason)
    .first<{ until: number }>();
  console.warn(`Twelve Data limit reached (${reason}); paused until ${new Date(row!.until).toISOString()}`);
  return row!.until;
}

/** When Twelve Data may be asked again, if it is paused now; otherwise null. */
export async function pausedUntil(db: D1Database, now = Date.now()): Promise<number | null> {
  const row = await db.prepare("SELECT until FROM api_pause WHERE source = ?1").bind(SOURCE).first<{ until: number }>();
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
