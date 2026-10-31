import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEndOfDayQuote, getEndOfDayQuotes, getEndOfDaySeries, nextRefresh, sliceRange } from "../../src/worker/market/endofday";
import { pausedUntil } from "../../src/worker/market/pause";
import { BusyError, UnavailableError } from "../../src/worker/market/service";
import { app } from "../../src/worker/index";
import { signIn } from "./auth-helpers";

// A stand-in for Alpha Vantage (and Twelve Data's free search, for names).
let av: (params: URLSearchParams) => unknown;
let avCalls: URLSearchParams[];
const BURST = "Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second). You may subscribe to any of the premium plans to lift the free key rate limit (25 requests per day)";
const DAILY = "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day. Please subscribe to any of the premium plans to instantly remove all daily rate limits.";

const globalQuote = (symbol: string, price = "1392.0500", day = "2026-10-30") => ({
  "Global Quote": {
    "01. symbol": symbol, "02. open": "1363.0000", "03. high": "1393.3700", "04. low": "1352.9800", "05. price": price,
    "06. volume": "5992730", "07. latest trading day": day, "08. previous close": "1354.0000", "09. change": "38.0500", "10. change percent": "2.8102%",
  },
});
const daily = (n: number) => ({
  "Meta Data": { "2. Symbol": "600519.SHH" },
  "Time Series (Daily)": Object.fromEntries(
    Array.from({ length: n }, (_, i) => [new Date(Date.UTC(2026, 9, 30) - i * 86_400_000).toISOString().slice(0, 10), { "4. close": String(1000 + i) }]),
  ),
});
const defaultAv = (p: URLSearchParams) => (p.get("function") === "GLOBAL_QUOTE" ? globalQuote(p.get("symbol")!) : daily(150));

beforeEach(() => {
  avCalls = [];
  av = defaultAv;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.host === "www.alphavantage.co") {
      expect(url.searchParams.get("apikey")).toBe("test-av-key");
      avCalls.push(url.searchParams);
      return Response.json(av(url.searchParams));
    }
    if (url.host === "api.twelvedata.com" && url.pathname === "/symbol_search") {
      return Response.json({
        data: [
          { symbol: "600519", instrument_name: "Kweichow Moutai Co., Ltd.", exchange: "SSE", mic_code: "XSHG", country: "China", currency: "CNY", instrument_type: "Common Stock", access: { plan: "Pro" } },
          { symbol: "000002", instrument_name: "China Vanke Co., Ltd.", exchange: "SZSE", mic_code: "XSHE", country: "China", currency: "CNY", instrument_type: "Common Stock", access: { plan: "Pro" } },
        ],
      });
    }
    throw new Error(`Unexpected fetch to ${url.href}`);
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.prepare("DELETE FROM api_pause").run();
});

// A Tuesday, 10:00 UTC (after the 08:00 UTC refresh), on a week of its own for each test.
let week = 0;
const nextWeek = () => Date.parse("2026-12-01T10:00:00Z") + ++week * 7 * 86_400_000;
const get = (path: string, cookie?: string) => app.request(path, { headers: cookie ? { cookie } : {} }, env);

describe("end-of-day schedule", () => {
  it("keeps a copy until the next weekday 08:00 UTC, an hour after Shanghai closes", () => {
    expect(nextRefresh(Date.parse("2026-12-03T07:59:00Z"))).toBe(Date.parse("2026-12-03T08:00:00Z"));
    expect(nextRefresh(Date.parse("2026-12-03T08:00:00Z"))).toBe(Date.parse("2026-12-04T08:00:00Z"));
    // Friday after the refresh: Monday.
    expect(nextRefresh(Date.parse("2026-12-04T10:00:00Z"))).toBe(Date.parse("2026-12-07T08:00:00Z"));
  });

  it("slices the last 100 trading days for each range", () => {
    const points = Array.from({ length: 100 }, (_, i) => ({ t: Date.UTC(2026, 9, 30) / 1000 - (99 - i) * 86_400, c: i }));
    expect(sliceRange(points, "5D")).toHaveLength(5);
    expect(sliceRange(points, "1M")).toHaveLength(32);
    expect(sliceRange(points, "6M")).toHaveLength(100);
    expect(sliceRange(points, "YTD").every((p) => new Date(p.t * 1000).getUTCFullYear() === 2026)).toBe(true);
  });
});

describe("Shanghai and Shenzhen stocks from Alpha Vantage", () => {
  it("open from search for the owner only, with Alpha Vantage's symbol", async () => {
    const owner = await signIn("owner@example.com");
    const other = await signIn("someone@example.com");
    const results = async (cookie?: string) => ((await (await get("/api/search?q=moutai", cookie)).json()) as any).results;
    expect((await results(owner)).filter((r: any) => r.available).map((r: any) => r.symbol)).toEqual(["600519.SHH", "000002.SHZ"]);
    expect((await results(other)).find((r: any) => r.symbol === "600519")).toMatchObject({ available: false });
    expect((await results()).some((r: any) => r.available)).toBe(false);
    expect(avCalls).toHaveLength(0);
  });

  it("give the owner the last close, named from Twelve Data's search, cached until the next close", async () => {
    const t = nextWeek();
    const q = await getEndOfDayQuote(env, "600519.SHH", t);
    expect(q.data).toMatchObject({ symbol: "600519.SHH", name: "Kweichow Moutai Co., Ltd.", exchange: "SSE", currency: "CNY", price: 1392.05, changePercent: 2.8102, endOfDay: true, asOf: "2026-10-30T07:00:00.000Z" });
    expect((await getEndOfDayQuote(env, "600519.SHH", t + 20 * 3_600_000)).stale).toBe(false);
    expect(avCalls).toHaveLength(1);
    // After the next day's refresh time it asks again.
    await getEndOfDayQuote(env, "600519.SHH", t + 23 * 3_600_000);
    expect(avCalls).toHaveLength(2);
  });

  it("are not available to anyone else, even when cached", async () => {
    const owner = await signIn("owner@example.com");
    const other = await signIn("other@example.com");
    expect((await get("/api/quote?symbol=000002.SHZ", owner)).status).toBe(200);
    expect(avCalls).toHaveLength(1);
    expect((await get("/api/quote?symbol=000002.SHZ", other)).status).toBe(404);
    expect((await get("/api/quote?symbol=000002.SHZ")).status).toBe(404);
    expect((await get("/api/chart?symbol=000002.SHZ&range=1M", other)).status).toBe(404);
    expect(await (await get("/api/quotes?symbols=000002.SHZ", other)).json()).toEqual({ quotes: {}, pending: [], unavailable: ["000002.SHZ"] });
    expect(avCalls).toHaveLength(1);
  });

  it("chart daily prices for 5D, 1M, 6M and YTD from one request, and no other range", async () => {
    const t = nextWeek();
    const m = await getEndOfDaySeries(env, "600519.SHH", "1M", t);
    expect(m.data).toMatchObject({ range: "1M", interval: "1day" });
    expect(m.data.points.at(-1)).toEqual({ t: Date.UTC(2026, 9, 30) / 1000, c: 1000 });
    expect((await getEndOfDaySeries(env, "600519.SHH", "5D", t + 1000)).data.points).toHaveLength(5);
    expect(avCalls.map((p) => [p.get("function"), p.get("outputsize")])).toEqual([["TIME_SERIES_DAILY", "compact"]]);
    await expect(getEndOfDaySeries(env, "600519.SHH", "1D", t)).rejects.toBeInstanceOf(UnavailableError);
    await expect(getEndOfDaySeries(env, "600519.SHH", "MAX", t)).rejects.toBeInstanceOf(UnavailableError);
  });

  it("fill a list one stock per request, the rest pending, beside Twelve Data's stocks", async () => {
    const t = nextWeek();
    const first = await getEndOfDayQuotes(env, ["601318.SHH", "600036.SHH", "000858.SHZ"], t);
    expect(Object.keys(first.quotes)).toEqual(["601318.SHH"]);
    expect(first.pending).toEqual(["600036.SHH", "000858.SHZ"]);
    const second = await getEndOfDayQuotes(env, ["601318.SHH", "600036.SHH", "000858.SHZ"], t + 20_000);
    expect(Object.keys(second.quotes)).toEqual(["601318.SHH", "600036.SHH"]);
    expect(avCalls).toHaveLength(2);
  });

  it("remember a symbol Alpha Vantage does not have", async () => {
    av = () => ({ "Global Quote": {} });
    const t = nextWeek();
    await expect(getEndOfDayQuote(env, "688981.SHH", t)).rejects.toBeInstanceOf(UnavailableError);
    await expect(getEndOfDayQuote(env, "688981.SHH", t + 1000)).rejects.toBeInstanceOf(UnavailableError);
    expect(avCalls).toHaveLength(1);
  });

  it("pause Alpha Vantage for two seconds after its per-second note", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    av = () => ({ Information: BURST });
    const t = nextWeek();
    await expect(getEndOfDayQuote(env, "600000.SHH", t)).rejects.toEqual(new BusyError(2));
    await expect(getEndOfDayQuote(env, "600000.SHH", t + 1000)).rejects.toBeInstanceOf(BusyError);
    expect(avCalls).toHaveLength(1);
    av = defaultAv;
    expect((await getEndOfDayQuote(env, "600000.SHH", t + 2500)).data.price).toBe(1392.05);
  });

  it("pause until the next UTC day after the daily limit, still serving cached prices", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = nextWeek();
    await getEndOfDayQuote(env, "600900.SHH", t);
    av = () => ({ Information: DAILY });
    const nextDay = t + 24 * 3_600_000;
    const q = await getEndOfDayQuote(env, "600900.SHH", nextDay);
    expect(q).toMatchObject({ stale: true, data: { symbol: "600900.SHH" } });
    expect(await pausedUntil(env.DB, nextDay, "alphavantage")).toBe(Date.parse(new Date(nextDay).toISOString().slice(0, 10)) + 86_400_000);
    await expect(getEndOfDaySeries(env, "600900.SHH", "1M", nextDay + 1000)).rejects.toBeInstanceOf(BusyError);
    expect(avCalls).toHaveLength(2);
    // Twelve Data is not paused by it.
    expect(await pausedUntil(env.DB, nextDay)).toBeNull();
  });
});
