// Twelve Data client: turns its responses into the app's shapes (src/shared/market.ts).
import type { InstrumentType, Quote, Range, SearchResult, Series, SeriesPoint } from "../../shared/market";

const BASE = "https://api.twelvedata.com";
/** The plan name Twelve Data gives symbols covered by the free plan. */
const FREE_PLAN = "Basic";

export class TwelveDataError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

/** Twelve Data's codes for a symbol that does not exist or is not on the plan. */
export const isNotCovered = (code: number) => code === 400 || code === 403 || code === 404;

async function getJson(fetchFn: Fetch, path: string, params: Record<string, string>): Promise<any> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetchFn(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    throw new TwelveDataError(`Twelve Data answered ${res.status} with no JSON`, res.status || 502);
  }
  if (!res.ok || body?.status === "error") {
    throw new TwelveDataError(body?.message ?? `Twelve Data answered ${res.status}`, body?.code ?? res.status);
  }
  return body;
}

const TYPES: Record<string, InstrumentType> = {
  "Common Stock": "stock",
  "Preferred Stock": "stock",
  "Depositary Receipt": "stock",
  REIT: "stock",
  ETF: "etf",
  "Mutual Fund": "fund",
  Index: "index",
  "Digital Currency": "crypto",
  "Physical Currency": "currency",
};

export function instrumentType(label: string | undefined): InstrumentType {
  return (label && TYPES[label]) || "other";
}

/** Searches by name or ticker. Twelve Data's search needs no key and uses no credits. */
export async function searchSymbols(fetchFn: Fetch, query: string): Promise<SearchResult[]> {
  const body = await getJson(fetchFn, "/symbol_search", { symbol: query, outputsize: "30", show_plan: "true" });
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const d of body.data ?? []) {
    const type = instrumentType(d.instrument_type);
    const available = d.access?.plan === FREE_PLAN;
    // Crypto and currency pairs come once per venue, and US listings once per US exchange:
    // the app quotes plain symbols, so one row per available symbol is enough.
    const key = available ? `${d.symbol}` : `${d.symbol}|${d.mic_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      symbol: d.symbol,
      name: d.instrument_name ?? d.symbol,
      exchange: type === "crypto" ? "Crypto" : type === "currency" ? "Currency" : (d.exchange ?? ""),
      country: d.country ?? "",
      currency: d.currency ?? "",
      type,
      typeLabel: d.instrument_type ?? "",
      available,
    });
  }
  // Available symbols first, otherwise in Twelve Data's order.
  return results.sort((a, b) => Number(b.available) - Number(a.available));
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function toQuote(q: any): Quote {
  const price = num(q.close);
  if (price === null) throw new TwelveDataError(`No price for ${q.symbol}`, 404);
  const seconds = num(q.last_quote_at) ?? num(q.timestamp) ?? Date.now() / 1000;
  return {
    symbol: q.symbol,
    name: q.name ?? q.symbol,
    exchange: q.exchange ?? "",
    currency: q.currency ?? (typeof q.symbol === "string" && q.symbol.includes("/") ? q.symbol.split("/")[1] : ""),
    price,
    change: num(q.change) ?? 0,
    changePercent: num(q.percent_change) ?? 0,
    open: num(q.open),
    high: num(q.high),
    low: num(q.low),
    previousClose: num(q.previous_close),
    volume: num(q.volume),
    averageVolume: num(q.average_volume),
    fiftyTwoWeekLow: num(q.fifty_two_week?.low),
    fiftyTwoWeekHigh: num(q.fifty_two_week?.high),
    isMarketOpen: Boolean(q.is_market_open),
    asOf: new Date(seconds * 1000).toISOString(),
  };
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; code: number; message: string };

/** One request for several symbols; it costs one credit per symbol. */
export async function fetchQuotes(fetchFn: Fetch, apiKey: string, symbols: string[]): Promise<Map<string, QuoteResult>> {
  let body: any;
  try {
    body = await getJson(fetchFn, "/quote", { symbol: symbols.join(","), apikey: apiKey });
  } catch (e) {
    // With one symbol, an unknown or uncovered symbol fails the whole request.
    if (symbols.length === 1 && e instanceof TwelveDataError && isNotCovered(e.code)) {
      return new Map([[symbols[0], { ok: false, code: e.code, message: e.message }]]);
    }
    throw e;
  }
  // One symbol: the quote itself. Several: an object keyed by symbol.
  const bySymbol: Record<string, any> = symbols.length === 1 ? { [symbols[0]]: body } : body;
  const out = new Map<string, QuoteResult>();
  for (const s of symbols) {
    const q = bySymbol[s];
    if (!q || q.status === "error" || q.code) {
      out.set(s, { ok: false, code: q?.code ?? 404, message: q?.message ?? "No data" });
      continue;
    }
    try {
      out.set(s, { ok: true, quote: toQuote(q) });
    } catch (e) {
      out.set(s, { ok: false, code: 404, message: (e as Error).message });
    }
  }
  return out;
}

interface RangeSpec {
  interval: string;
  outputsize?: number;
  /** Keep only the points this returns true for (given the points, newest last). */
  keep?: (points: SeriesPoint[], tz: string, roundTheClock: boolean) => SeriesPoint[];
  startDate?: (now: Date) => string;
}

const DAY = 86_400;

function localDate(t: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" }).format(new Date(t * 1000));
}

function lastDays(n: number) {
  return (points: SeriesPoint[], tz: string, roundTheClock: boolean) => {
    if (points.length === 0) return points;
    const last = points[points.length - 1].t;
    if (roundTheClock) return points.filter((p) => p.t > last - n * DAY);
    const dates: string[] = [];
    for (let i = points.length - 1; i >= 0 && dates.length <= n; i--) {
      const d = localDate(points[i].t, tz);
      if (dates[dates.length - 1] !== d) dates.push(d);
    }
    const keepDates = new Set(dates.slice(0, n));
    return points.filter((p) => keepDates.has(localDate(p.t, tz)));
  };
}

function since(seconds: number) {
  return (points: SeriesPoint[]) => {
    if (points.length === 0) return points;
    const last = points[points.length - 1].t;
    return points.filter((p) => p.t >= last - seconds);
  };
}

export const RANGE_SPECS: Record<Range, RangeSpec> = {
  "1D": { interval: "5min", outputsize: 300, keep: lastDays(1) },
  "5D": { interval: "30min", outputsize: 300, keep: lastDays(5) },
  "1M": { interval: "1h", outputsize: 750, keep: since(31 * DAY) },
  "6M": { interval: "1day", outputsize: 140, keep: since(183 * DAY) },
  YTD: { interval: "1day", startDate: (now) => `${now.getUTCFullYear()}-01-01` },
  "1Y": { interval: "1day", outputsize: 260, keep: since(366 * DAY) },
  "5Y": { interval: "1week", outputsize: 270, keep: since(5 * 366 * DAY) },
  MAX: { interval: "1month", outputsize: 5000 },
};

/** One chart range; it costs one credit. */
export async function fetchSeries(
  fetchFn: Fetch,
  apiKey: string,
  symbol: string,
  range: Range,
  now = new Date(),
): Promise<Series> {
  const spec = RANGE_SPECS[range];
  const params: Record<string, string> = {
    symbol,
    interval: spec.interval,
    timezone: "UTC",
    order: "asc",
    apikey: apiKey,
  };
  if (spec.outputsize) params.outputsize = String(spec.outputsize);
  if (spec.startDate) params.start_date = spec.startDate(now);
  const body = await getJson(fetchFn, "/time_series", params);
  const tz: string = body.meta?.exchange_timezone || "UTC";
  const type = instrumentType(body.meta?.type);
  const roundTheClock = type === "crypto" || type === "currency";
  let points: SeriesPoint[] = (body.values ?? [])
    .map((v: any) => ({ t: Date.parse(`${v.datetime.replace(" ", "T")}${v.datetime.length > 10 ? "Z" : "T00:00:00Z"}`) / 1000, c: Number(v.close) }))
    .filter((p: SeriesPoint) => Number.isFinite(p.t) && Number.isFinite(p.c))
    .sort((a: SeriesPoint, b: SeriesPoint) => a.t - b.t);
  if (spec.keep) points = spec.keep(points, tz, roundTheClock);
  return { symbol, range, interval: spec.interval, timezone: tz, points };
}
