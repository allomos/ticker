import { Hono } from "hono";
import { isEndOfDaySymbol, RANGES, type QuotesResponse, type Range } from "../../shared/market";
import type { Context } from "hono";
import type { AppEnv } from "../auth/session";
import { userAccess } from "../keys/store";
import type { Access } from "./access";
import { getEndOfDayQuote, getEndOfDayQuotes, getEndOfDaySeries, ownerResults } from "./endofday";
import { BusyError, getQuote, getQuotes, getSeries, search, UnavailableError } from "./service";

const SYMBOL = /^[A-Za-z0-9.\-/:^=]{1,24}$/;
const MAX_SYMBOLS = 100;

export const market = new Hono<AppEnv>();

/** The owner, signed in, is the only one who gets Alpha Vantage's (end-of-day) stocks on the app's key, cached or not. */
function isOwner(c: Context<AppEnv>): boolean {
  const owner = c.env.MARKET_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && c.var.user && c.var.user.email.toLowerCase() === owner);
}

/**
 * Whose keys this request uses. Twelve Data: the user's own key if they added one, else the
 * app's. End-of-day stocks: the user's own Alpha Vantage key, else the app's for the owner only,
 * else none (null: not available).
 */
async function keysFor(c: Context<AppEnv>): Promise<{ twelvedata?: Access; endOfDay: Access | undefined | null }> {
  const own = await userAccess(c);
  return { twelvedata: own.twelvedata, endOfDay: own.alphavantage ?? (isOwner(c) ? undefined : null) };
}

market.onError((err, c) => {
  if (err instanceof BusyError) {
    c.header("Retry-After", String(err.retryAfter));
    return c.json({ error: "busy", retryAfter: err.retryAfter }, 503);
  }
  if (err instanceof UnavailableError) return c.json({ error: "unavailable" }, 404);
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

market.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length > 64) return c.json({ error: "bad_request" }, 400);
  let results = q ? await search(c.env, q) : [];
  const keys = await keysFor(c);
  // A user's own Twelve Data key may be on a plan that covers more: they may try any listing.
  if (keys.twelvedata) results = results.map((r) => ({ ...r, available: true }));
  return c.json({ results: keys.endOfDay !== null ? ownerResults(results) : results });
});

market.get("/quote", async (c) => {
  const symbol = c.req.query("symbol") ?? "";
  if (!SYMBOL.test(symbol)) return c.json({ error: "bad_request" }, 400);
  const keys = await keysFor(c);
  if (isEndOfDaySymbol(symbol)) {
    if (keys.endOfDay === null) throw new UnavailableError(symbol);
    return c.json(await getEndOfDayQuote(c.env, symbol, undefined, keys.endOfDay));
  }
  return c.json(await getQuote(c.env, symbol, undefined, keys.twelvedata));
});

market.get("/quotes", async (c) => {
  const symbols = (c.req.query("symbols") ?? "").split(",").filter(Boolean);
  if (symbols.length === 0 || symbols.length > MAX_SYMBOLS || !symbols.every((s) => SYMBOL.test(s))) {
    return c.json({ error: "bad_request" }, 400);
  }
  const keys = await keysFor(c);
  const endOfDay = symbols.filter(isEndOfDaySymbol);
  const out = await getQuotes(c.env, symbols.filter((s) => !isEndOfDaySymbol(s)), undefined, keys.twelvedata);
  if (endOfDay.length) {
    const eod: QuotesResponse =
      keys.endOfDay === null ? { quotes: {}, pending: [], unavailable: endOfDay } : await getEndOfDayQuotes(c.env, endOfDay, undefined, keys.endOfDay);
    Object.assign(out.quotes, eod.quotes);
    out.pending.push(...eod.pending);
    out.unavailable.push(...eod.unavailable);
  }
  return c.json(out);
});

market.get("/chart", async (c) => {
  const symbol = c.req.query("symbol") ?? "";
  const range = (c.req.query("range") ?? "1D") as Range;
  if (!SYMBOL.test(symbol) || !RANGES.includes(range)) return c.json({ error: "bad_request" }, 400);
  const keys = await keysFor(c);
  if (isEndOfDaySymbol(symbol)) {
    if (keys.endOfDay === null) throw new UnavailableError(symbol);
    return c.json(await getEndOfDaySeries(c.env, symbol, range, undefined, keys.endOfDay));
  }
  return c.json(await getSeries(c.env, symbol, range, undefined, keys.twelvedata));
});
