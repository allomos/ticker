import { env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { fetchQuotes, fetchSeries, searchSymbols, toQuote } from "../../src/worker/market/twelvedata";
import { fakeTwelveData, quoteFixture, quoteHandler, type FakeTwelveData } from "./fake-twelvedata";

let fake: FakeTwelveData | undefined;
afterEach(() => fake?.restore());

describe("test setup", () => {
  it("never uses the real Twelve Data key", () => {
    expect(env.TWELVE_DATA_API_KEY).toBe("test-key");
  });
});

describe("search", () => {
  it("keeps one row per available symbol, puts available ones first, and sends no key", async () => {
    fake = fakeTwelveData({
      "/symbol_search": () => ({
        data: [
          { symbol: "7203", instrument_name: "Toyota", exchange: "JPX", mic_code: "XJPX", instrument_type: "Common Stock", country: "Japan", currency: "JPY", access: { plan: "Pro" } },
          { symbol: "AAPL", instrument_name: "Apple Inc.", exchange: "NASDAQ", mic_code: "XNGS", instrument_type: "Common Stock", country: "United States", currency: "USD", access: { plan: "Basic" } },
          { symbol: "AAPL", instrument_name: "Apple Inc.", exchange: "IEX", mic_code: "IEXG", instrument_type: "Common Stock", country: "United States", currency: "USD", access: { plan: "Basic" } },
          { symbol: "BTC/USD", instrument_name: "Bitcoin US Dollar", exchange: "Binance", mic_code: "DIGITAL_CURRENCY", instrument_type: "Digital Currency", currency: "USD", access: { plan: "Basic" } },
          { symbol: "BTC/USD", instrument_name: "Bitcoin US Dollar", exchange: "Coinbase Pro", mic_code: "DIGITAL_CURRENCY", instrument_type: "Digital Currency", access: { plan: "Basic" } },
        ],
      }),
    });
    const results = await searchSymbols(fetch, "apple");
    expect(results.map((r) => [r.symbol, r.exchange, r.available])).toEqual([
      ["AAPL", "NASDAQ", true],
      ["BTC/USD", "Crypto", true],
      ["7203", "JPX", false],
    ]);
    expect(results[1].type).toBe("crypto");
    expect(fake.calls[0].searchParams.has("apikey")).toBe(false);
  });
});

describe("quotes", () => {
  it("turns a quote into the app's shape", () => {
    const q = toQuote(quoteFixture("AAPL"));
    expect(q).toMatchObject({
      symbol: "AAPL",
      price: 344.63,
      change: -4.28,
      changePercent: -1.22668,
      previousClose: 348.91,
      fiftyTwoWeekHigh: 351.73,
      isMarketOpen: false,
      asOf: new Date(1793390340 * 1000).toISOString(),
    });
  });

  it("reads single and batch answers, with errors per symbol", async () => {
    fake = fakeTwelveData({ "/quote": quoteHandler((s) => (s === "NOPE" ? "error" : {})) });
    const one = await fetchQuotes(fetch, "k", ["AAPL"]);
    expect(one.get("AAPL")).toMatchObject({ ok: true, quote: { symbol: "AAPL" } });
    const many = await fetchQuotes(fetch, "k", ["AAPL", "NOPE"]);
    expect(many.get("AAPL")?.ok).toBe(true);
    expect(many.get("NOPE")).toMatchObject({ ok: false, code: 404 });
  });
});

describe("chart ranges", () => {
  const minutes = (start: string, count: number, step: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = new Date(Date.parse(start) + i * step * 60_000);
      return { datetime: d.toISOString().slice(0, 19).replace("T", " "), close: String(100 + i) };
    });

  it("1D keeps only the last trading day, in the exchange's time zone", async () => {
    fake = fakeTwelveData({
      "/time_series": () => ({
        meta: { symbol: "AAPL", exchange_timezone: "America/New_York", type: "Common Stock" },
        values: [...minutes("2026-10-29T13:30:00Z", 78, 5), ...minutes("2026-10-30T13:30:00Z", 78, 5)],
      }),
    });
    const s = await fetchSeries(fetch, "k", "AAPL", "1D");
    expect(s.points).toHaveLength(78);
    expect(new Date(s.points[0].t * 1000).toISOString()).toBe("2026-10-30T13:30:00.000Z");
    expect(fake.calls[0].searchParams.get("interval")).toBe("5min");
    expect(fake.calls[0].searchParams.get("timezone")).toBe("UTC");
  });

  it("1D for crypto keeps the last 24 hours", async () => {
    fake = fakeTwelveData({
      "/time_series": () => ({
        meta: { symbol: "BTC/USD", exchange_timezone: "UTC", type: "Digital Currency" },
        values: minutes("2026-10-30T00:00:00Z", 300, 5),
      }),
    });
    const s = await fetchSeries(fetch, "k", "BTC/USD", "1D");
    expect(s.points).toHaveLength(288);
  });

  it("YTD starts on 1 January", async () => {
    fake = fakeTwelveData({ "/time_series": () => ({ meta: {}, values: [{ datetime: "2026-01-02", close: "1" }] }) });
    const s = await fetchSeries(fetch, "k", "AAPL", "YTD", new Date("2026-10-31T00:00:00Z"));
    expect(fake.calls[0].searchParams.get("start_date")).toBe("2026-01-01");
    expect(s.points).toEqual([{ t: Date.parse("2026-01-02T00:00:00Z") / 1000, c: 1 }]);
  });
});
