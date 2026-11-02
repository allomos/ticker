import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/worker/index";
import { searchSymbols } from "../../src/worker/market/twelvedata";
import { quoteFixture } from "./fake-twelvedata";
import { signIn } from "./auth-helpers";

const OWN = "td-own-key-tokyo";
const OWN_NO_TOKYO = "td-own-key-us-only";
let calls: URL[];
beforeEach(() => {
  calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.host !== "api.twelvedata.com") throw new Error(`Unexpected fetch to ${url.host}`);
    calls.push(url);
    const key = url.searchParams.get("apikey");
    const symbol = url.searchParams.get("symbol")!;
    const tokyo = url.searchParams.get("exchange") === "JPX";
    if (tokyo && key !== OWN) return Response.json({ code: 400, message: "There is an error in the query.", status: "error" });
    if (url.pathname === "/quote") return Response.json(tokyo ? quoteFixture(symbol, { name: "Toyota Motor Corp", exchange: "JPX", currency: "JPY" }) : quoteFixture(symbol));
    if (url.pathname === "/time_series") return Response.json({ meta: { exchange_timezone: "Asia/Tokyo" }, values: [{ datetime: "2026-10-30", close: "2900" }] });
    return Response.json({ code: 404, message: "no fixture", status: "error" });
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.batch([env.DB.prepare("DELETE FROM market_cache"), env.DB.prepare("DELETE FROM api_pause")]);
});

const get = (path: string, cookie?: string, key?: string) =>
  app.request(path, { headers: { ...(cookie ? { cookie } : {}), ...(key ? { "x-ticker-key-twelvedata": key } : {}) } }, env);

describe("Tokyo stocks", () => {
  it("show in search as 7203.T, off the free plan even where Twelve Data says Basic", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ data: [{ symbol: "7203", instrument_name: "Toyota Motor Corp", exchange: "JPX", mic_code: "XJPX", country: "Japan", currency: "JPY", instrument_type: "Common Stock", access: { plan: "Basic" } }] }),
    );
    expect(await searchSymbols(fetch, "toyota")).toMatchObject([{ symbol: "7203.T", exchange: "JPX", available: false }]);
  });

  it("are not available to anyone without their own Twelve Data key, the owner included, and cost no request", async () => {
    const owner = await signIn("owner@example.com");
    for (const cookie of [owner, undefined]) {
      expect((await get("/api/quote?symbol=7203.T", cookie)).status).toBe(404);
      expect((await get("/api/chart?symbol=7203.T&range=1M", cookie)).status).toBe(404);
      expect(await (await get("/api/quotes?symbols=7203.T", cookie)).json()).toEqual({ quotes: {}, pending: [], unavailable: ["7203.T"] });
    }
    expect(calls).toHaveLength(0);
  });

  it("open with the user's own key, asking for the code on JPX and keeping the app's symbol", async () => {
    const me = await signIn("tokyo@example.com");
    const q = await get("/api/quote?symbol=7203.T", me, OWN);
    expect(await q.json()).toMatchObject({ data: { symbol: "7203.T", name: "Toyota Motor Corp", currency: "JPY" } });
    const c = await get("/api/chart?symbol=7203.T&range=1M", me, OWN);
    expect(c.status).toBe(200);
    const list = await (await get("/api/quotes?symbols=AAPL,7203.T", me, OWN)).json<any>();
    expect(Object.keys(list.quotes).sort()).toEqual(["7203.T", "AAPL"]);
    const asked = calls.map((u) => [u.pathname, u.searchParams.get("symbol"), u.searchParams.get("exchange"), u.searchParams.get("apikey")]);
    expect(asked).toEqual([
      ["/quote", "7203", "JPX", OWN],
      ["/time_series", "7203", "JPX", OWN],
      ["/quote", "AAPL", null, OWN],
    ]);
  });

  it("say when the user's own key's plan does not cover them", async () => {
    const me = await signIn("ustonly@example.com");
    const r = await get("/api/quote?symbol=7203.T", me, OWN_NO_TOKYO);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "unavailable", reason: "own_key" });
  });
});
