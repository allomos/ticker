// Market data for the API: cached in D1, shared by all users, and fetched from Twelve Data
// unless it is paused after answering that the free plan's limit is reached (./pause.ts). While
// paused, the latest cached data is returned, marked stale.
import type { Cached, Quote, QuotesResponse, Range, SearchResult, Series } from "../../shared/market";
import type { Env } from "../env";
import { aliasMatches } from "./aliases";
import { sharedTwelveData, type Access } from "./access";
import { cacheGet, cacheGetMany, cachePut, type CacheEntry } from "./cache";
import { isLimit, MAX_BATCH, pause, pausedUntil, retryAfter } from "./pause";
import { fetchQuotes, fetchSeries, isNotCovered, searchSymbols, TwelveDataError, type QuoteResult } from "./twelvedata";

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

// Requests to Twelve Data in flight in this Worker instance, so identical requests that arrive
// together share one (and its credits) instead of each sending their own.
const quotesInFlight = new Map<string, Promise<QuoteResult | undefined>>();
const seriesInFlight = new Map<string, Promise<Series | null>>();

export function quoteTtl(q: Quote): number {
  return q.isMarketOpen ? 5 * MIN : HOUR;
}

/** No data yet and Twelve Data paused (or not answering): try again after `retryAfter` seconds. */
export class BusyError extends Error {
  constructor(readonly retryAfter: number) {
    super("The data plan's limit is reached for now");
  }
}

/** The symbol is not covered by the data plan, or does not exist. */
export class UnavailableError extends Error {}

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

export async function getQuotes(env: Env, symbols: string[], now = Date.now(), access?: Access): Promise<QuotesResponse> {
  const a = access ?? sharedTwelveData(env);
  const unique = [...new Set(symbols)];
  const hits = await cacheGetMany<Stored>(env.DB, unique.map((s) => `${a.prefix}q:${s}`));
  const response: QuotesResponse = { quotes: {}, pending: [], unavailable: [] };
  const toFetch: { symbol: string; fetchedAt: number }[] = [];
  for (const symbol of unique) {
    const hit = hits.get(`${a.prefix}q:${symbol}`);
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
  // Missing ones first, then the stalest. Symbols another request is already fetching wait for it;
  // the others are marked as in flight at once, before anything else is awaited.
  toFetch.sort((a, b) => a.fetchedAt - b.fetchedAt);
  const joined = toFetch.filter((f) => quotesInFlight.has(a.prefix + f.symbol)).map((f) => [f.symbol, quotesInFlight.get(a.prefix + f.symbol)!] as const);
  const own = toFetch.filter((f) => !quotesInFlight.has(a.prefix + f.symbol)).map((f) => f.symbol);
  const done = new Map<string, (r: QuoteResult | undefined) => void>();
  for (const symbol of own) {
    quotesInFlight.set(a.prefix + symbol, new Promise((resolve) => done.set(symbol, resolve)));
  }
  const finish = (symbol: string, r: QuoteResult | undefined) => {
    done.get(symbol)?.(r);
    quotesInFlight.delete(a.prefix + symbol);
  };
  const ownResults = new Map<string, QuoteResult>();
  try {
    // The rest of a long list waits for a later request: polled again by the app.
    const fetchNow = own.length && !(await pausedUntil(env.DB, now, a.source)) ? own.slice(0, MAX_BATCH) : [];
    if (fetchNow.length) {
      try {
        let limit: string | null = null;
        for (const [symbol, r] of await fetchQuotes(fetch, a.key, fetchNow)) {
          if (r.ok) await cachePut(env.DB, `${a.prefix}q:${symbol}`, { quote: r.quote } satisfies Stored, now);
          else if (isLimit(r.code)) limit = r.message;
          else if (isNotCovered(r.code)) await cachePut(env.DB, `${a.prefix}q:${symbol}`, { unavailable: r.message } satisfies Stored, now);
          ownResults.set(symbol, r);
        }
        if (limit) await pause(env.DB, limit, now, a.source);
      } catch (e) {
        if (!(e instanceof TwelveDataError)) throw e;
        if (isLimit(e.code)) await pause(env.DB, e.message, now, a.source);
        else console.warn("Twelve Data quote failed:", e.code, e.message);
      }
    }
  } finally {
    for (const symbol of own) finish(symbol, ownResults.get(symbol));
  }
  const settled: (readonly [string, QuoteResult | undefined])[] = [
    ...own.map((symbol) => [symbol, ownResults.get(symbol)] as const),
    ...(await Promise.all(joined.map(async ([symbol, result]) => [symbol, await result] as const))),
  ];
  for (const [symbol, r] of settled) {
    if (!r) continue;
    if (r.ok) response.quotes[symbol] = { data: r.quote, fetchedAt: new Date(now).toISOString(), stale: false };
    else if (isNotCovered(r.code)) response.unavailable.push(symbol);
  }
  // Whatever is still missing: the stale copy when there is one, otherwise later.
  for (const { symbol } of toFetch) {
    if (response.quotes[symbol] || response.unavailable.includes(symbol)) continue;
    const hit = hits.get(`${a.prefix}q:${symbol}`);
    if (hit && "quote" in hit.value) {
      response.quotes[symbol] = { data: hit.value.quote, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: true };
    } else {
      response.pending.push(symbol);
    }
  }
  return response;
}

export async function getQuote(env: Env, symbol: string, now = Date.now(), access?: Access): Promise<Cached<Quote>> {
  const a = access ?? sharedTwelveData(env);
  const r = await getQuotes(env, [symbol], now, a);
  if (r.quotes[symbol]) return r.quotes[symbol];
  if (r.unavailable.includes(symbol)) throw new UnavailableError(symbol);
  throw new BusyError(retryAfter(await pausedUntil(env.DB, now, a.source), now));
}

export async function getSeries(env: Env, symbol: string, range: Range, now = Date.now(), access?: Access): Promise<Cached<Series>> {
  const a = access ?? sharedTwelveData(env);
  const key = `${a.prefix}c:${range}:${symbol}`;
  const ttl = SERIES_TTL[range];
  const hit = await cacheGet<Series>(env.DB, key);
  if (hit && now - hit.fetchedAt < ttl) return cached(hit, ttl, now);
  let pending = seriesInFlight.get(key);
  if (!pending) {
    // Marked as in flight at once, before the pause is checked.
    pending = (async () => {
      if (await pausedUntil(env.DB, now, a.source)) return null;
      const series = await fetchSeries(fetch, a.key, symbol, range, new Date(now));
      await cachePut(env.DB, key, series, now);
      return series;
    })();
    seriesInFlight.set(key, pending);
    pending.finally(() => seriesInFlight.delete(key)).catch(() => {});
  }
  if (pending) {
    try {
      const series = await pending;
      if (series) return { data: series, fetchedAt: new Date(now).toISOString(), stale: false };
    } catch (e) {
      if (!(e instanceof TwelveDataError)) throw e;
      if (isLimit(e.code)) await pause(env.DB, e.message, now, a.source);
      else if (!hit && isNotCovered(e.code)) throw new UnavailableError(symbol);
      else console.warn("Twelve Data series failed:", e.code, e.message);
    }
  }
  if (hit) return cached(hit, ttl, now);
  throw new BusyError(retryAfter(await pausedUntil(env.DB, now, a.source), now));
}
