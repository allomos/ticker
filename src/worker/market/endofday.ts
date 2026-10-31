// Shanghai and Shenzhen stocks from Alpha Vantage, for the app's owner only (its free key is for
// personal use). Prices are end-of-day: each stock is fetched at most once after a close and
// served from the shared cache until the next one. One Alpha Vantage request at most per call,
// since the free key allows one a second; a longer list gets the rest on the app's next poll.
import { END_OF_DAY_RANGES, type Cached, type Quote, type QuotesResponse, type Range, type SearchResult, type Series, type SeriesPoint } from "../../shared/market";
import type { Env } from "../env";
import { AlphaVantageError, fetchDailyCloses, fetchDailyQuote } from "./alphavantage";
import { cacheGet, cacheGetMany, cachePut, type CacheEntry } from "./cache";
import { pause, pausedUntil, retryAfter } from "./pause";
import { BusyError, search, UnavailableError } from "./service";

const DAY = 86_400_000;
/** Alpha Vantage has the day's close an hour after the 15:00 Beijing close (07:00 UTC). */
const REFRESH_UTC_HOUR = 8;

/** Twelve Data's exchange for each Alpha Vantage suffix. */
const EXCHANGES: Record<string, string> = { SHH: "SSE", SHZ: "SZSE" };

/** The first weekday 08:00 UTC after `fetchedAt`: until then the cached copy is the latest. */
export function nextRefresh(fetchedAt: number): number {
  let t = Math.floor(fetchedAt / DAY) * DAY + REFRESH_UTC_HOUR * 3_600_000;
  if (t <= fetchedAt) t += DAY;
  while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY;
  return t;
}

const fresh = (e: { fetchedAt: number }, now: number) => now < nextRefresh(e.fetchedAt);
const asCached = <T>(e: CacheEntry<T>, now: number): Cached<T> => ({ data: e.value, fetchedAt: new Date(e.fetchedAt).toISOString(), stale: !fresh(e, now) });

/** For the owner: Shanghai and Shenzhen results open with Alpha Vantage's symbol. */
export function ownerResults(results: SearchResult[]): SearchResult[] {
  return results.map((r) => {
    const suffix = Object.keys(EXCHANGES).find((s) => EXCHANGES[s] === r.exchange);
    return suffix && /^\d{6}$/.test(r.symbol) ? { ...r, symbol: `${r.symbol}.${suffix}`, available: true } : r;
  });
}

function apiKey(env: Env): string {
  if (!env.ALPHA_VANTAGE_API_KEY) throw new Error("ALPHA_VANTAGE_API_KEY is not set");
  return env.ALPHA_VANTAGE_API_KEY;
}

/** Name, exchange and currency from Twelve Data's search, which costs no credits. */
async function describe(env: Env, symbol: string, now: number): Promise<Pick<Quote, "name" | "exchange" | "currency">> {
  const [code, suffix] = symbol.split(".");
  const exchange = EXCHANGES[suffix];
  try {
    const match = (await search(env, code, now)).find((r) => r.symbol === code && r.exchange === exchange);
    if (match) return { name: match.name, exchange, currency: match.currency || "CNY" };
  } catch {
    // The name is a nicety: fall back to the code.
  }
  return { name: code, exchange, currency: "CNY" };
}

type Stored = { quote: Quote } | { unavailable: string };
const quotesInFlight = new Map<string, Promise<Quote | "unavailable" | null>>();
const closesInFlight = new Map<string, Promise<SeriesPoint[] | "unavailable" | null>>();

/** Shares one request among callers asking for the same thing at once. */
function once<T>(map: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
  let p = map.get(key);
  if (!p) {
    p = run();
    map.set(key, p);
    p.finally(() => map.delete(key)).catch(() => {});
  }
  return p;
}

/** Asks Alpha Vantage unless it is paused: the result, "unavailable", or null (paused, failed). */
async function ask<T>(env: Env, symbol: string, now: number, fetchIt: () => Promise<T>, store: (v: T) => Promise<void>): Promise<T | "unavailable" | null> {
  if (await pausedUntil(env.DB, now, "alphavantage")) return null;
  try {
    const value = await fetchIt();
    await store(value);
    return value;
  } catch (e) {
    if (!(e instanceof AlphaVantageError)) throw e;
    if (e.kind === "limit") await pause(env.DB, e.message, now, "alphavantage");
    else if (e.kind === "not-found") {
      await cachePut(env.DB, `q:${symbol}`, { unavailable: e.message } satisfies Stored, now);
      return "unavailable";
    } else console.warn("Alpha Vantage failed:", e.message);
    return null;
  }
}

function refreshQuote(env: Env, symbol: string, now: number) {
  return once(quotesInFlight, symbol, () =>
    ask(
      env,
      symbol,
      now,
      async () => ({ ...(await fetchDailyQuote(fetch, apiKey(env), symbol)), ...(await describe(env, symbol, now)) }) as Quote,
      (quote) => cachePut(env.DB, `q:${symbol}`, { quote } satisfies Stored, now),
    ),
  );
}

async function busy(env: Env, now: number): Promise<never> {
  throw new BusyError(retryAfter(await pausedUntil(env.DB, now, "alphavantage"), now));
}

export async function getEndOfDayQuote(env: Env, symbol: string, now = Date.now()): Promise<Cached<Quote>> {
  const hit = await cacheGet<Stored>(env.DB, `q:${symbol}`);
  if (hit && "unavailable" in hit.value && fresh(hit, now)) throw new UnavailableError(symbol);
  if (hit && "quote" in hit.value && fresh(hit, now)) return asCached({ value: hit.value.quote, fetchedAt: hit.fetchedAt }, now);
  const r = await refreshQuote(env, symbol, now);
  if (r === "unavailable") throw new UnavailableError(symbol);
  if (r) return { data: r, fetchedAt: new Date(now).toISOString(), stale: false };
  if (hit && "quote" in hit.value) return asCached({ value: hit.value.quote, fetchedAt: hit.fetchedAt }, now);
  return busy(env, now);
}

/** A list's end-of-day prices: cached ones, and at most one fetched now; the rest come later. */
export async function getEndOfDayQuotes(env: Env, symbols: string[], now = Date.now()): Promise<QuotesResponse> {
  const unique = [...new Set(symbols)];
  const hits = await cacheGetMany<Stored>(env.DB, unique.map((s) => `q:${s}`));
  const out: QuotesResponse = { quotes: {}, pending: [], unavailable: [] };
  let fetched = false;
  for (const symbol of unique) {
    const hit = hits.get(`q:${symbol}`);
    if (hit && fresh(hit, now)) {
      if ("quote" in hit.value) out.quotes[symbol] = asCached({ value: hit.value.quote, fetchedAt: hit.fetchedAt }, now);
      else out.unavailable.push(symbol);
      continue;
    }
    if (!fetched) {
      fetched = true;
      const r = await refreshQuote(env, symbol, now);
      if (r === "unavailable") {
        out.unavailable.push(symbol);
        continue;
      }
      if (r) {
        out.quotes[symbol] = { data: r, fetchedAt: new Date(now).toISOString(), stale: false };
        continue;
      }
    }
    if (hit && "quote" in hit.value) out.quotes[symbol] = asCached({ value: hit.value.quote, fetchedAt: hit.fetchedAt }, now);
    else out.pending.push(symbol);
  }
  return out;
}

/** The part of the last 100 trading days a range shows. */
export function sliceRange(points: SeriesPoint[], range: Range): SeriesPoint[] {
  const last = points.at(-1)?.t;
  if (last === undefined) return points;
  if (range === "5D") return points.slice(-5);
  if (range === "1M") return points.filter((p) => p.t >= last - 31 * 86_400);
  if (range === "6M") return points.filter((p) => p.t >= last - 183 * 86_400);
  const jan1 = Date.UTC(new Date(last * 1000).getUTCFullYear(), 0, 1) / 1000;
  return points.filter((p) => p.t >= jan1);
}

export async function getEndOfDaySeries(env: Env, symbol: string, range: Range, now = Date.now()): Promise<Cached<Series>> {
  if (!END_OF_DAY_RANGES.includes(range)) throw new UnavailableError(symbol);
  const key = `c:daily:${symbol}`;
  const series = (points: SeriesPoint[]): Series => ({ symbol, range, interval: "1day", timezone: "Asia/Shanghai", points: sliceRange(points, range) });
  const hit = await cacheGet<SeriesPoint[]>(env.DB, key);
  if (hit && fresh(hit, now)) return { ...asCached(hit, now), data: series(hit.value) };
  const r = await once(closesInFlight, symbol, () =>
    ask(env, symbol, now, () => fetchDailyCloses(fetch, apiKey(env), symbol), (points) => cachePut(env.DB, key, points, now)),
  );
  if (r === "unavailable") throw new UnavailableError(symbol);
  if (r) return { data: series(r), fetchedAt: new Date(now).toISOString(), stale: false };
  if (hit) return { ...asCached(hit, now), data: series(hit.value) };
  return busy(env, now);
}
