// Market data for the API: cached in D1, shared by all users, and fetched from Twelve Data
// only within the free plan's budget. When the budget is spent, the latest cached data is
// returned, marked stale.
import type { Cached, Quote, QuotesResponse, Range, SearchResult, Series } from "../../shared/market";
import type { Env } from "../env";
import { aliasMatches } from "./aliases";
import { reserve, reserveUpTo, secondsToNextMinute } from "./budget";
import { cacheGet, cacheGetMany, cachePut, type CacheEntry } from "./cache";
import { fetchQuotes, fetchSeries, isNotCovered, searchSymbols, TwelveDataError } from "./twelvedata";

const MIN = 60_000;
const HOUR = 60 * MIN;
const SEARCH_TTL = 7 * 24 * HOUR;
const UNAVAILABLE_TTL = 24 * HOUR;
const SERIES_TTL: Record<Range, number> = {
  "1D": 10 * MIN,
  "5D": 30 * MIN,
  "1M": 2 * HOUR,
  "6M": 12 * HOUR,
  YTD: 12 * HOUR,
  "1Y": 12 * HOUR,
  "5Y": 24 * HOUR,
  MAX: 24 * HOUR,
};

export function quoteTtl(q: Quote): number {
  return q.isMarketOpen ? 5 * MIN : HOUR;
}

/** No data yet and no budget left to fetch it: try again after `retryAfter` seconds. */
export class BusyError extends Error {
  constructor(readonly retryAfter: number) {
    super("The data plan's limit is reached for now");
  }
}

/** The symbol is not covered by the data plan, or does not exist. */
export class UnavailableError extends Error {}

function apiKey(env: Env): string {
  if (!env.TWELVE_DATA_API_KEY) throw new Error("TWELVE_DATA_API_KEY is not set");
  return env.TWELVE_DATA_API_KEY;
}

const cached = <T>(e: CacheEntry<T>, ttl: number, now: number): Cached<T> => ({
  data: e.value,
  fetchedAt: new Date(e.fetchedAt).toISOString(),
  stale: now - e.fetchedAt > ttl,
});

export async function search(env: Env, query: string, now = Date.now()): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const key = `s:${q}`;
  const hit = await cacheGet<SearchResult[]>(env.DB, key);
  let results: SearchResult[];
  if (hit && now - hit.fetchedAt < SEARCH_TTL) {
    results = hit.value;
  } else {
    try {
      results = await searchSymbols(fetch, q);
      await cachePut(env.DB, key, results, now);
    } catch (e) {
      if (hit) results = hit.value;
      else throw e;
    }
  }
  const aliases = aliasMatches(q).filter((a) => !results.some((r) => r.symbol === a.symbol));
  return [...aliases, ...results];
}

type Stored = { quote: Quote } | { unavailable: string };

export async function getQuotes(env: Env, symbols: string[], now = Date.now()): Promise<QuotesResponse> {
  const unique = [...new Set(symbols)];
  const hits = await cacheGetMany<Stored>(env.DB, unique.map((s) => `q:${s}`));
  const response: QuotesResponse = { quotes: {}, pending: [], unavailable: [] };
  const toFetch: { symbol: string; fetchedAt: number }[] = [];
  for (const symbol of unique) {
    const hit = hits.get(`q:${symbol}`);
    if (hit && "unavailable" in hit.value) {
      if (now - hit.fetchedAt < UNAVAILABLE_TTL) response.unavailable.push(symbol);
      else toFetch.push({ symbol, fetchedAt: 0 });
      continue;
    }
    if (hit && "quote" in hit.value && now - hit.fetchedAt < quoteTtl(hit.value.quote)) {
      response.quotes[symbol] = cached({ value: hit.value.quote, fetchedAt: hit.fetchedAt }, quoteTtl(hit.value.quote), now);
      continue;
    }
    toFetch.push({ symbol, fetchedAt: hit?.fetchedAt ?? 0 });
  }
  // Missing ones first, then the stalest.
  toFetch.sort((a, b) => a.fetchedAt - b.fetchedAt);
  const granted = toFetch.length ? await reserveUpTo(env.DB, toFetch.length, now) : 0;
  const fetchNow = toFetch.slice(0, granted).map((f) => f.symbol);
  if (fetchNow.length) {
    try {
      const results = await fetchQuotes(fetch, apiKey(env), fetchNow);
      for (const [symbol, r] of results) {
        if (r.ok) {
          await cachePut(env.DB, `q:${symbol}`, { quote: r.quote } satisfies Stored, now);
          response.quotes[symbol] = { data: r.quote, fetchedAt: new Date(now).toISOString(), stale: false };
        } else if (isNotCovered(r.code)) {
          await cachePut(env.DB, `q:${symbol}`, { unavailable: r.message } satisfies Stored, now);
          response.unavailable.push(symbol);
        }
      }
    } catch (e) {
      if (!(e instanceof TwelveDataError)) throw e;
      console.warn("Twelve Data quote failed:", e.code, e.message);
    }
  }
  // Whatever is still missing: the stale copy when there is one, otherwise later.
  for (const { symbol } of toFetch) {
    if (response.quotes[symbol] || response.unavailable.includes(symbol)) continue;
    const hit = hits.get(`q:${symbol}`);
    if (hit && "quote" in hit.value) {
      response.quotes[symbol] = { data: hit.value.quote, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: true };
    } else {
      response.pending.push(symbol);
    }
  }
  return response;
}

export async function getQuote(env: Env, symbol: string, now = Date.now()): Promise<Cached<Quote>> {
  const r = await getQuotes(env, [symbol], now);
  if (r.quotes[symbol]) return r.quotes[symbol];
  if (r.unavailable.includes(symbol)) throw new UnavailableError(symbol);
  throw new BusyError(secondsToNextMinute(now));
}

export async function getSeries(env: Env, symbol: string, range: Range, now = Date.now()): Promise<Cached<Series>> {
  const key = `c:${range}:${symbol}`;
  const ttl = SERIES_TTL[range];
  const hit = await cacheGet<Series>(env.DB, key);
  if (hit && now - hit.fetchedAt < ttl) return cached(hit, ttl, now);
  if (await reserve(env.DB, 1, now)) {
    try {
      const series = await fetchSeries(fetch, apiKey(env), symbol, range, new Date(now));
      await cachePut(env.DB, key, series, now);
      return { data: series, fetchedAt: new Date(now).toISOString(), stale: false };
    } catch (e) {
      if (!(e instanceof TwelveDataError)) throw e;
      if (!hit && isNotCovered(e.code)) throw new UnavailableError(symbol);
      console.warn("Twelve Data series failed:", e.code, e.message);
    }
  }
  if (hit) return cached(hit, ttl, now);
  throw new BusyError(secondsToNextMinute(now));
}
