import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/worker/index";
import { open, seal } from "../../src/worker/keys/crypto";
import { quoteFixture } from "./fake-twelvedata";
import { json, signIn } from "./auth-helpers";

// Twelve Data and Alpha Vantage stand-ins that answer according to the key sent.
const GOOD_TD = "td-user-key-0001";
const GOOD_AV = "av-user-key-0002";
let calls: URL[];
let tdLimitFor: string | null;
beforeEach(() => {
  calls = [];
  tdLimitFor = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url);
    const key = url.searchParams.get("apikey");
    if (url.host === "api.twelvedata.com") {
      if (url.pathname === "/api_usage") {
        return key === GOOD_TD ? Response.json({ current_usage: 0, plan_limit: 55, plan_category: "grow" }) : Response.json({ code: 401, message: "**apikey** parameter is incorrect", status: "error" });
      }
      if (url.pathname === "/symbol_search") return Response.json({ data: [{ symbol: "7203", instrument_name: "Toyota Motor Corp", exchange: "TSE", mic_code: "XTKS", country: "Japan", currency: "JPY", instrument_type: "Common Stock", access: { plan: "Pro" } }] });
      if (url.pathname === "/quote") {
        if (key === tdLimitFor) return Response.json({ code: 429, message: "You have run out of API credits for the current minute.", status: "error" });
        const symbol = url.searchParams.get("symbol")!;
        // The free key does not cover Tokyo; a paid one does.
        if (symbol === "7203" && key !== GOOD_TD) return Response.json({ code: 403, message: "not on your plan", status: "error" }, { status: 403 });
        return Response.json(quoteFixture(symbol, { name: `${symbol} via ${key === GOOD_TD ? "own" : "shared"}` }));
      }
    }
    if (url.host === "www.alphavantage.co") {
      if (key !== GOOD_AV && key !== "test-av-key") return Response.json({ "Error Message": "the parameter apikey is invalid" });
      return Response.json({ "Global Quote": { "01. symbol": url.searchParams.get("symbol"), "05. price": "10.0000", "07. latest trading day": "2026-10-30", "09. change": "0.1000", "10. change percent": "1.0000%" } });
    }
    throw new Error(`Unexpected fetch to ${url.host}`);
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.batch([env.DB.prepare("DELETE FROM api_pause"), env.DB.prepare("DELETE FROM market_cache")]);
});

const req = (path: string, cookie?: string, init: RequestInit = {}, headers: Record<string, string> = {}) =>
  app.request(path, { ...init, headers: { ...(cookie ? { cookie } : {}), ...headers, ...((init.headers as Record<string, string>) ?? {}) } }, env);
const putKey = (cookie: string, source: string, key: string) => req(`/api/keys/${source}`, cookie, { ...json({ key }), method: "PUT" });
const keysUsed = () => calls.filter((u) => u.pathname === "/quote" || u.host === "www.alphavantage.co").map((u) => u.searchParams.get("apikey"));

describe("key encryption", () => {
  it("round-trips, with a fresh nonce each time, and only for the same user", async () => {
    const a = await seal(env, "user-1", "secret-key-1234");
    const b = await seal(env, "user-1", "secret-key-1234");
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toContain("secret");
    expect(await open(env, "user-1", a)).toBe("secret-key-1234");
    await expect(open(env, "user-2", a)).rejects.toThrow();
  });
});

describe("keys API", () => {
  it("needs a signed-in user", async () => {
    expect((await req("/api/keys")).status).toBe(401);
  });

  it("checks, keeps (encrypted), lists masked and removes a key", async () => {
    const me = await signIn("keys@example.com");
    expect(await (await req("/api/keys/check", me, json({ source: "twelvedata", key: "wrong" }))).json()).toMatchObject({ ok: false });
    expect((await putKey(me, "twelvedata", "wrong")).status).toBe(422);
    const put = await putKey(me, "twelvedata", GOOD_TD);
    expect(await put.json()).toEqual({ ok: true, last4: "0001" });
    const listed = await (await req("/api/keys", me)).json();
    expect(listed).toMatchObject({ keys: [{ source: "twelvedata", last4: "0001" }] });
    expect(JSON.stringify(listed)).not.toContain(GOOD_TD);
    const row = await env.DB.prepare("SELECT * FROM user_keys").first();
    expect(JSON.stringify(row)).not.toContain(GOOD_TD);
    expect((await req("/api/keys/twelvedata", me, { ...json({}), method: "DELETE" })).status).toBe(200);
    expect(await (await req("/api/keys", me)).json()).toEqual({ keys: [] });
  });

  it("are removed with the account", async () => {
    const me = await signIn("leaving@example.com");
    await putKey(me, "alphavantage", GOOD_AV);
    const id = await env.DB.prepare("SELECT id FROM users WHERE email = 'leaving@example.com'").first<string>("id");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM user_keys WHERE user_id = ?1").bind(id).first("n")).toBe(1);
    await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM user_keys WHERE user_id = ?1").bind(id).first("n")).toBe(0);
  });
});

describe("a user's own key", () => {
  it("is used for that user's requests, and what it fetches is served to that user only", async () => {
    const me = await signIn("paid@example.com");
    const other = await signIn("free@example.com");
    await putKey(me, "twelvedata", GOOD_TD);
    const search = (await (await req("/api/search?q=toyota", me)).json()) as any;
    expect(search.results[0]).toMatchObject({ symbol: "7203", available: true });
    const mine = await req("/api/quote?symbol=7203", me);
    expect(await mine.json()).toMatchObject({ data: { name: "7203 via own" } });
    // The other user, on the app's free key, does not get it from the cache.
    expect((await req("/api/quote?symbol=7203", other)).status).toBe(404);
    expect(keysUsed()).toEqual([GOOD_TD, "test-key"]);
  });

  it("can come from the browser with the request, used for it only and never kept", async () => {
    const me = await signIn("browser@example.com");
    const res = await req("/api/quote?symbol=7203", me, {}, { "x-ticker-key-twelvedata": GOOD_TD });
    expect(await res.json()).toMatchObject({ data: { name: "7203 via own" } });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM user_keys k JOIN users u ON u.id = k.user_id WHERE u.email = 'browser@example.com'").first("n")).toBe(0);
    // Signed out, a key header is ignored.
    expect((await req("/api/quote?symbol=7203", undefined, {}, { "x-ticker-key-twelvedata": GOOD_TD })).status).toBe(404);
  });

  it("is paused on its own after a limit answer; other users are not affected", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const me = await signIn("limited@example.com");
    const other = await signIn("unaffected@example.com");
    await putKey(me, "twelvedata", GOOD_TD);
    tdLimitFor = GOOD_TD;
    expect((await req("/api/quote?symbol=MSFT", me)).status).toBe(503);
    expect((await req("/api/quote?symbol=MSFT", other)).status).toBe(200);
    expect((await req("/api/quote?symbol=AMZN", me)).status).toBe(503);
    expect(keysUsed()).toEqual([GOOD_TD, "test-key"]);
  });

  it("opens Shanghai and Shenzhen stocks for anyone with their own Alpha Vantage key", async () => {
    const me = await signIn("china@example.com");
    const other = await signIn("nochina@example.com");
    await putKey(me, "alphavantage", GOOD_AV);
    expect((await req("/api/quote?symbol=600519.SHH", me)).status).toBe(200);
    expect((await req("/api/quote?symbol=600519.SHH", other)).status).toBe(404);
    expect(keysUsed().filter((k) => k !== "test-key")).toEqual([GOOD_AV, GOOD_AV]);
  });
});
