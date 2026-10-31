import { env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/worker/index";
import { MINUTE_LIMIT } from "../../src/worker/market/budget";
import { getQuote, getQuotes, getSeries, search } from "../../src/worker/market/service";
import { fakeTwelveData, quoteHandler, type FakeTwelveData } from "./fake-twelvedata";

let fake: FakeTwelveData | undefined;
afterEach(() => fake?.restore());

// Each test uses its own minute, so budgets do not mix.
let minute = 0;
const nextMinute = () => Date.parse("2026-10-31T00:00:00Z") + ++minute * 60_000 * 3;

describe("quote cache", () => {
  it("serves a second request from the cache, without credits", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler() });
    const t = nextMinute();
    const a = await getQuote(env, "MSFT", t);
    const b = await getQuote(env, "MSFT", t + 1000);
    expect(a.data.price).toBe(344.63);
    expect(b.stale).toBe(false);
    expect(fake.credits()).toBe(1);
  });

  it("refreshes after the cache time, which is shorter while the market is open", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler(() => ({ is_market_open: true })) });
    const t = nextMinute();
    await getQuote(env, "NVDA", t);
    await getQuote(env, "NVDA", t + 4 * 60_000);
    expect(fake.credits()).toBe(1);
    await getQuote(env, "NVDA", t + 6 * 60_000);
    expect(fake.credits()).toBe(2);
  });

  it("fetches only what the minute allows; the rest comes later", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler() });
    const t = nextMinute();
    const symbols = Array.from({ length: 10 }, (_, i) => `L${i}`);
    const first = await getQuotes(env, symbols, t);
    expect(Object.keys(first.quotes)).toHaveLength(MINUTE_LIMIT);
    expect(first.pending).toHaveLength(10 - MINUTE_LIMIT);
    expect(fake.calls).toHaveLength(1);
    const second = await getQuotes(env, symbols, t + 60_000);
    expect(Object.keys(second.quotes)).toHaveLength(10);
    expect(second.pending).toEqual([]);
    expect(fake.credits()).toBe(10);
  });

  it("returns the stale copy, marked, when the budget is spent", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler() });
    const t = nextMinute();
    await getQuote(env, "AMZN", t);
    // Two hours later the copy is old; the minute's budget is used up by others.
    const later = t + 2 * 3_600_000;
    await getQuotes(env, Array.from({ length: MINUTE_LIMIT }, (_, i) => `B${i}`), later);
    const r = await getQuote(env, "AMZN", later);
    expect(r.stale).toBe(true);
    expect(r.data.symbol).toBe("AMZN");
  });

  it("remembers symbols the plan does not cover", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler((s) => (s === "7203" ? "error" : {})) });
    const t = nextMinute();
    const r = await getQuotes(env, ["7203", "IBM"], t);
    expect(r.unavailable).toEqual(["7203"]);
    await expect(getQuote(env, "7203", t + 1000)).rejects.toThrow();
    expect(fake.credits()).toBe(2);
  });
});

describe("chart cache", () => {
  it("caches each range", async () => {
    fake = fakeTwelveData({ "/time_series": () => ({ meta: {}, values: [{ datetime: "2026-10-30", close: "5" }] }) });
    const t = nextMinute();
    await getSeries(env, "AAPL", "1Y", t);
    await getSeries(env, "AAPL", "1Y", t + 3_600_000);
    expect(fake.credits()).toBe(1);
    await getSeries(env, "AAPL", "5Y", t);
    expect(fake.credits()).toBe(2);
  });
});

describe("search", () => {
  it("caches results and adds crypto names", async () => {
    fake = fakeTwelveData({ "/symbol_search": () => ({ data: [] }) });
    const t = nextMinute();
    const r = await search(env, "Bitcoin", t);
    expect(r[0]).toMatchObject({ symbol: "BTC/USD", type: "crypto", available: true });
    await search(env, "bitcoin ", t + 1000);
    expect(fake.calls).toHaveLength(1);
    expect(fake.credits()).toBe(0);
  });
});

describe("API", () => {
  it("rejects bad input", async () => {
    expect((await app.request("/api/quote?symbol=%3Cscript%3E", {}, env)).status).toBe(400);
    expect((await app.request("/api/chart?symbol=AAPL&range=2W", {}, env)).status).toBe(400);
    expect((await app.request("/api/quotes?symbols=", {}, env)).status).toBe(400);
  });

  it("answers a quote and a chart", async () => {
    fake = fakeTwelveData({
      "/quote": quoteHandler(),
      "/time_series": () => ({ meta: {}, values: [{ datetime: "2026-10-30", close: "5" }] }),
    });
    const q = await app.request("/api/quote?symbol=ORCL", {}, env);
    expect(q.status).toBe(200);
    expect(await q.json()).toMatchObject({ data: { symbol: "ORCL" }, stale: false });
    const c = await app.request("/api/chart?symbol=ORCL&range=MAX", {}, env);
    expect(await c.json()).toMatchObject({ data: { range: "MAX", points: [{ c: 5 }] } });
  });

  it("answers 404 for a symbol the plan does not cover", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler(() => "error") });
    const r = await app.request("/api/quote?symbol=ZZZZ", {}, env);
    expect(r.status).toBe(404);
  });
});
