// Alpha Vantage client, for Shanghai and Shenzhen stocks (600519.SHH, 000002.SHZ), which the free
// Twelve Data plan does not cover. The free key gives end-of-day prices only, 25 requests a day
// and one a second, and answers a limit with an "Information" note (HTTP 200), not an error code.
import type { Quote, SeriesPoint } from "../../shared/market";

const BASE = "https://www.alphavantage.co/query";

export class AlphaVantageError extends Error {
  constructor(
    message: string,
    /** "limit": a per-second or daily limit (see the message); "not-found": no such symbol here. */
    readonly kind: "limit" | "not-found" | "error",
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

async function query(fetchFn: Fetch, apiKey: string, params: Record<string, string>): Promise<any> {
  const res = await fetchFn(`${BASE}?${new URLSearchParams({ ...params, apikey: apiKey })}`, { headers: { accept: "application/json" } });
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new AlphaVantageError(`Alpha Vantage answered ${res.status} with no JSON`, "error");
  }
  const note = body?.Information ?? body?.Note;
  if (typeof note === "string") throw new AlphaVantageError(note, "limit");
  if (typeof body?.["Error Message"] === "string") throw new AlphaVantageError(body["Error Message"], "not-found");
  if (!res.ok) throw new AlphaVantageError(`Alpha Vantage answered ${res.status}`, "error");
  return body;
}

const num = (v: unknown): number | null => {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

/** The day's close in Shanghai and Shenzhen, 15:00 Beijing time, as when the price is from. */
export const closeTime = (day: string) => `${day}T07:00:00.000Z`;

/** The last close's quote; the caller adds the name, exchange and currency. */
export async function fetchDailyQuote(
  fetchFn: Fetch,
  apiKey: string,
  symbol: string,
): Promise<Omit<Quote, "name" | "exchange" | "currency">> {
  const body = await query(fetchFn, apiKey, { function: "GLOBAL_QUOTE", symbol });
  const q = body?.["Global Quote"];
  const price = num(q?.["05. price"]);
  const day = q?.["07. latest trading day"];
  if (!q || price === null || !/^\d{4}-\d\d-\d\d$/.test(day ?? "")) throw new AlphaVantageError(`No quote for ${symbol}`, "not-found");
  return {
    symbol,
    price,
    change: num(q["09. change"]) ?? 0,
    changePercent: num(String(q["10. change percent"] ?? "").replace("%", "")) ?? 0,
    open: num(q["02. open"]),
    high: num(q["03. high"]),
    low: num(q["04. low"]),
    previousClose: num(q["08. previous close"]),
    volume: num(q["06. volume"]),
    averageVolume: null,
    fiftyTwoWeekLow: null,
    fiftyTwoWeekHigh: null,
    isMarketOpen: false,
    asOf: closeTime(day),
    endOfDay: true,
  };
}

/** Daily closes for the last 100 trading days (the free "compact" size), oldest first. */
export async function fetchDailyCloses(fetchFn: Fetch, apiKey: string, symbol: string): Promise<SeriesPoint[]> {
  const body = await query(fetchFn, apiKey, { function: "TIME_SERIES_DAILY", symbol, outputsize: "compact" });
  const days = body?.["Time Series (Daily)"];
  if (!days || typeof days !== "object") throw new AlphaVantageError(`No daily prices for ${symbol}`, "not-found");
  return Object.entries(days as Record<string, Record<string, string>>)
    .map(([day, v]) => ({ t: Date.parse(`${day}T00:00:00Z`) / 1000, c: num(v["4. close"]) ?? Number.NaN }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c))
    .sort((a, b) => a.t - b.t);
}
