import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/worker/index";
import { pause, pauseEnd, pausedUntil, prune } from "../../src/worker/market/pause";
import { BusyError, getQuote, getQuotes, getSeries } from "../../src/worker/market/service";
import { fakeTwelveData, limitReached, quoteHandler, type FakeTwelveData } from "./fake-twelvedata";

let fake: FakeTwelveData | undefined;
afterEach(async () => {
  fake?.restore();
  vi.restoreAllMocks();
  await env.DB.prepare("DELETE FROM api_pause").run();
});
const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

// 10:00:20 UTC on a day of its own for each test.
let day = 0;
const nextDay = () => Date.parse("2026-12-01T10:00:20Z") + ++day * 86_400_000;
const series = { meta: {}, values: [{ datetime: "2026-10-30", close: "5" }] };

describe("pause after Twelve Data's limit", () => {
  it("reads the minute and the day limits from Twelve Data's message", async () => {
    const t = Date.parse("2026-12-01T10:00:20Z");
    expect(pauseEnd((await limitReached("minute").json<any>()).message, t)).toEqual({ until: Date.parse("2026-12-01T10:01:00Z"), reason: "minute" });
    expect(pauseEnd((await limitReached("day").json<any>()).message, t)).toEqual({ until: Date.parse("2026-12-02T00:00:00Z"), reason: "day" });
  });

  it("stops asking for the rest of the minute after a 429, says how long to wait, then asks again", async () => {
    quiet();
    let limited = true;
    const ok = quoteHandler();
    fake = fakeTwelveData({ "/quote": (url) => (limited ? limitReached("minute") : ok(url)) });
    const t = nextDay();
    await expect(getQuote(env, "PAUSE1", t)).rejects.toEqual(new BusyError(40));
    expect(await pausedUntil(env.DB, t)).toBe(t + 40_000);
    // Later in the same minute nobody asks Twelve Data.
    await expect(getQuote(env, "PAUSE2", t + 10_000)).rejects.toEqual(new BusyError(30));
    const pending = await getQuotes(env, ["PAUSE1", "PAUSE2"], t + 10_000);
    expect(pending.pending).toEqual(["PAUSE1", "PAUSE2"]);
    expect(fake.calls).toHaveLength(1);
    // The next minute it asks again.
    limited = false;
    expect((await getQuote(env, "PAUSE1", t + 41_000)).data.symbol).toBe("PAUSE1");
    expect(fake.calls).toHaveLength(2);
  });

  it("pauses until the next UTC day after the daily limit, still serving cached prices", async () => {
    quiet();
    let limited = false;
    const ok = quoteHandler();
    fake = fakeTwelveData({ "/quote": (url) => (limited ? limitReached("day") : ok(url)), "/time_series": () => series });
    const t = nextDay();
    await getQuote(env, "CACHED", t);
    await getSeries(env, "CACHED", "1M", t);
    limited = true;
    const later = t + 3 * 3_600_000;
    await expect(getQuote(env, "NEW", later)).rejects.toBeInstanceOf(BusyError);
    const midnight = Math.floor(later / 86_400_000) * 86_400_000 + 86_400_000;
    expect(await pausedUntil(env.DB, later)).toBe(midnight);
    // The old copies are still served, marked stale where they are past their time.
    const q = await getQuote(env, "CACHED", later);
    expect(q).toMatchObject({ data: { symbol: "CACHED" }, stale: true });
    expect((await getSeries(env, "CACHED", "1M", later + 3_600_000)).stale).toBe(true);
    const calls = fake.calls.length;
    // The API answers busy with how long to wait; Twelve Data is not asked.
    const res = await app.request("/api/quote?symbol=OTHER", {}, env);
    expect(res.status).toBe(503);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(120);
    expect(fake.calls.length).toBe(calls);
  });

  it("pauses quotes too when a chart hits the limit", async () => {
    quiet();
    fake = fakeTwelveData({ "/time_series": () => limitReached("minute"), "/quote": quoteHandler() });
    const t = nextDay();
    await expect(getSeries(env, "CHART", "5D", t)).rejects.toBeInstanceOf(BusyError);
    await expect(getQuote(env, "CHART", t + 1000)).rejects.toBeInstanceOf(BusyError);
    expect(fake.calls.map((u) => u.pathname)).toEqual(["/time_series"]);
  });

  it("keeps a longer pause when a shorter one follows, and clears ended pauses", async () => {
    quiet();
    const t = nextDay();
    const dayEnd = await pause(env.DB, "You have run out of API credits for the day.", t);
    expect(await pause(env.DB, "You have run out of API credits for the current minute.", t + 1000)).toBe(dayEnd);
    await prune(env.DB, dayEnd + 1);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM api_pause").first("n")).toBe(0);
  });
});
