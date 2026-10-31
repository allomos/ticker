// A stand-in for Twelve Data in tests: records requests and answers from fixtures.
import { vi } from "vitest";

export function quoteFixture(symbol: string, over: Record<string, unknown> = {}) {
  return {
    symbol,
    name: `${symbol} Inc.`,
    exchange: "NASDAQ",
    mic_code: "XNGS",
    currency: "USD",
    datetime: "2026-10-30",
    timestamp: 1793367000,
    last_quote_at: 1793390340,
    open: "346.72",
    high: "349.19",
    low: "334.35",
    close: "344.63",
    volume: "67797500",
    previous_close: "348.91",
    change: "-4.28",
    percent_change: "-1.22668",
    average_volume: "42129920",
    is_market_open: false,
    fifty_two_week: { low: "243.42", high: "351.73" },
    ...over,
  };
}

export interface FakeTwelveData {
  calls: URL[];
  credits(): number;
  restore(): void;
}

type Handler = (url: URL) => unknown | Promise<unknown>;

/** Replaces fetch for api.twelvedata.com; other hosts fail the test. */
export function fakeTwelveData(handlers: Partial<Record<"/quote" | "/time_series" | "/symbol_search", Handler>>): FakeTwelveData {
  const calls: URL[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.host !== "api.twelvedata.com") throw new Error(`Unexpected fetch to ${url.host}`);
    calls.push(url);
    const handler = handlers[url.pathname as keyof typeof handlers];
    if (!handler) return Response.json({ status: "error", code: 404, message: "no fixture" }, { status: 404 });
    const body = await handler(url);
    return body instanceof Response ? body : Response.json(body);
  });
  return {
    calls,
    credits: () =>
      calls
        .filter((u) => u.searchParams.has("apikey"))
        .reduce((n, u) => n + (u.pathname === "/quote" ? (u.searchParams.get("symbol") ?? "").split(",").length : 1), 0),
    restore: () => spy.mockRestore(),
  };
}

/** Answers /quote for whatever symbols are asked, in Twelve Data's single or batch shape. */
export function quoteHandler(over: (symbol: string) => Record<string, unknown> | "error" = () => ({})) {
  return (url: URL) => {
    const symbols = (url.searchParams.get("symbol") ?? "").split(",");
    const one = (s: string) => {
      const o = over(s);
      return o === "error" ? { code: 404, message: `**symbol** ${s} not found`, status: "error" } : quoteFixture(s, o);
    };
    if (symbols.length === 1) {
      const o = over(symbols[0]);
      if (o === "error") return Response.json({ code: 404, message: "not found", status: "error" }, { status: 404 });
      return one(symbols[0]);
    }
    return Object.fromEntries(symbols.map((s) => [s, one(s)]));
  };
}

/** Twelve Data's answer when the free plan's limit is reached, for the minute or the day. */
export function limitReached(per: "minute" | "day") {
  const message =
    per === "minute"
      ? "You have run out of API credits for the current minute. 9 API credits were used, with the current limit being 8. Wait for the next minute or consider switching to a higher tier plan at https://twelvedata.com/pricing"
      : "You have run out of API credits for the day. 801 API credits were used, with the current limit being 800. Wait for the next day or consider switching to a higher tier plan at https://twelvedata.com/pricing";
  return Response.json({ code: 429, message, status: "error" }, { status: 429 });
}
