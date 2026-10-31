import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { DAY_LIMIT, MINUTE_LIMIT, prune, remaining, reserve, reserveUpTo, secondsToNextMinute } from "../../src/worker/market/budget";

const T0 = Date.parse("2026-10-31T10:00:05Z");

describe("request budget", () => {
  it("allows the minute limit and no more", async () => {
    expect(await reserve(env.DB, 5, T0)).toBe(true);
    expect(await reserve(env.DB, 2, T0)).toBe(true);
    expect(await reserve(env.DB, 1, T0)).toBe(false);
    expect(await remaining(env.DB, T0)).toBe(0);
    // A new minute starts fresh.
    expect(await reserve(env.DB, MINUTE_LIMIT, T0 + 60_000)).toBe(true);
  });

  it("never reserves more than one minute allows at once", async () => {
    expect(await reserve(env.DB, MINUTE_LIMIT + 1, T0 + 120_000)).toBe(false);
    expect(await remaining(env.DB, T0 + 120_000)).toBe(MINUTE_LIMIT);
  });

  it("reserves what is left when asked for more", async () => {
    const t = T0 + 180_000;
    await reserve(env.DB, 4, t);
    expect(await reserveUpTo(env.DB, 10, t)).toBe(MINUTE_LIMIT - 4);
    expect(await reserveUpTo(env.DB, 10, t)).toBe(0);
  });

  it("stops at the day limit and gives the minute back", async () => {
    const day = Date.parse("2026-11-02T00:00:00Z");
    let used = 0;
    for (let m = 0; used < DAY_LIMIT; m++) {
      const n = Math.min(MINUTE_LIMIT, DAY_LIMIT - used);
      expect(await reserve(env.DB, n, day + m * 60_000)).toBe(true);
      used += n;
    }
    const later = day + 200 * 60_000;
    expect(await reserve(env.DB, 1, later)).toBe(false);
    expect(await remaining(env.DB, later)).toBe(0);
    // The refused request did not use up the minute.
    const row = await env.DB.prepare("SELECT used FROM api_budget WHERE slot = ?1")
      .bind(`m:${new Date(later).toISOString().slice(0, 16)}`)
      .first<{ used: number }>();
    expect(row?.used ?? 0).toBe(0);
  });

  it("prunes old windows and old cache rows", async () => {
    await reserve(env.DB, 1, T0 - 2 * 3_600_000);
    await env.DB.prepare("INSERT INTO market_cache (key, value, fetched_at) VALUES ('old', '1', ?1)").bind(T0 - 40 * 86_400_000).run();
    await prune(env.DB, T0);
    const slots = await env.DB.prepare("SELECT COUNT(*) AS n FROM api_budget WHERE slot = ?1")
      .bind(`m:${new Date(T0 - 2 * 3_600_000).toISOString().slice(0, 16)}`)
      .first<{ n: number }>();
    expect(slots?.n).toBe(0);
    expect(await env.DB.prepare("SELECT * FROM market_cache WHERE key = 'old'").first()).toBeNull();
  });

  it("counts seconds to the next minute", () => {
    expect(secondsToNextMinute(T0)).toBe(55);
  });
});
