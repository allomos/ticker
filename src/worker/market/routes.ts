import { Hono } from "hono";
import { RANGES, type Range } from "../../shared/market";
import type { AppEnv } from "../auth/session";
import { BusyError, getQuote, getQuotes, getSeries, search, UnavailableError } from "./service";

const SYMBOL = /^[A-Za-z0-9.\-/:^=]{1,24}$/;
const MAX_SYMBOLS = 100;

export const market = new Hono<AppEnv>();

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
  return c.json({ results: q ? await search(c.env, q) : [] });
});

market.get("/quote", async (c) => {
  const symbol = c.req.query("symbol") ?? "";
  if (!SYMBOL.test(symbol)) return c.json({ error: "bad_request" }, 400);
  return c.json(await getQuote(c.env, symbol));
});

market.get("/quotes", async (c) => {
  const symbols = (c.req.query("symbols") ?? "").split(",").filter(Boolean);
  if (symbols.length === 0 || symbols.length > MAX_SYMBOLS || !symbols.every((s) => SYMBOL.test(s))) {
    return c.json({ error: "bad_request" }, 400);
  }
  return c.json(await getQuotes(c.env, symbols));
});

market.get("/chart", async (c) => {
  const symbol = c.req.query("symbol") ?? "";
  const range = (c.req.query("range") ?? "1D") as Range;
  if (!SYMBOL.test(symbol) || !RANGES.includes(range)) return c.json({ error: "bad_request" }, 400);
  return c.json(await getSeries(c.env, symbol, range));
});
