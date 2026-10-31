import { Hono } from "hono";
import { isEndOfDaySymbol, RANGES, type QuotesResponse, type Range } from "../../shared/market";
import type { Context } from "hono";
import type { AppEnv } from "../auth/session";
import { getEndOfDayQuote, getEndOfDayQuotes, getEndOfDaySeries, ownerResults } from "./endofday";
import { BusyError, getQuote, getQuotes, getSeries, search, UnavailableError } from "./service";

const SYMBOL = /^[A-Za-z0-9.\-/:^=]{1,24}$/;
const MAX_SYMBOLS = 100;

export const market = new Hono<AppEnv>();

/** The owner, signed in, is the only one who gets Alpha Vantage's (end-of-day) stocks, cached or not. */
function isOwner(c: Context<AppEnv>): boolean {
  const owner = c.env.MARKET_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && c.var.user && c.var.user.email.toLowerCase() === owner);
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
  const results = q ? await search(c.env, q) : [];
  return c.json({ results: isOwner(c) ? ownerResults(results) : results });
});

market.get("/quote", async (c) => {
  const symbol = c.req.query("symbol") ?? "";
  if (!SYMBOL.test(symbol)) return c.json({ error: "bad_request" }, 400);
  if (isEndOfDaySymbol(symbol)) {
    if (!isOwner(c)) throw new UnavailableError(symbol);
    return c.json(await getEndOfDayQuote(c.env, symbol));
  }
  return c.json(await getQuote(c.env, symbol));
});

market.get("/quotes", async (c) => {
  const symbols = (c.req.query("symbols") ?? "").split(",").filter(Boolean);
  if (symbols.length === 0 || symbols.length > MAX_SYMBOLS || !symbols.every((s) => SYMBOL.test(s))) {
    return c.json({ error: "bad_request" }, 400);
  }
  const endOfDay = symbols.filter(isEndOfDaySymbol);
  const out = await getQuotes(c.env, symbols.filter((s) => !isEndOfDaySymbol(s)));
  if (endOfDay.length) {
    const eod: QuotesResponse = isOwner(c) ? await getEndOfDayQuotes(c.env, endOfDay) : { quotes: {}, pending: [], unavailable: endOfDay };
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
  if (isEndOfDaySymbol(symbol)) {
    if (!isOwner(c)) throw new UnavailableError(symbol);
    return c.json(await getEndOfDaySeries(c.env, symbol, range));
  }
  return c.json(await getSeries(c.env, symbol, range));
});
