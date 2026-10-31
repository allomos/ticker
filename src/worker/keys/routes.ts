// A signed-in user's own data API keys: list (masked), check, keep on the server, remove.
import { Hono } from "hono";
import { requireUser, type AppEnv } from "../auth/session";
import { AlphaVantageError, fetchDailyQuote } from "../market/alphavantage";
import { TwelveDataError, twelveDataUsage } from "../market/twelvedata";
import { isKeySource, listKeys, putKey, removeKey, type KeySource } from "./store";

export const keys = new Hono<AppEnv>();
keys.use("*", requireUser);

const clean = (v: unknown) => String(v ?? "").trim();

/** Asks the source whether the key works: Twelve Data's usage costs no credits; Alpha Vantage one request. */
export async function checkKey(source: KeySource, key: string): Promise<{ ok: boolean; message?: string }> {
  try {
    if (source === "twelvedata") await twelveDataUsage(fetch, key);
    else await fetchDailyQuote(fetch, key, "IBM");
    return { ok: true };
  } catch (e) {
    if (e instanceof AlphaVantageError && e.kind === "limit") return { ok: true, message: "limit" };
    if (e instanceof TwelveDataError || e instanceof AlphaVantageError) return { ok: false, message: e.message };
    throw e;
  }
}

keys.get("/", async (c) => c.json({ keys: await listKeys(c.env.DB, c.var.user!.id) }));

keys.post("/check", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const key = clean(body?.key);
  if (!isKeySource(body?.source) || !key || key.length > 200) return c.json({ error: "bad_request" }, 400);
  return c.json(await checkKey(body.source, key));
});

keys.put("/:source", async (c) => {
  const source = c.req.param("source");
  const body = await c.req.json().catch(() => ({}));
  const key = clean(body?.key);
  if (!isKeySource(source) || !key || key.length > 200) return c.json({ error: "bad_request" }, 400);
  const check = await checkKey(source, key);
  if (!check.ok) return c.json({ error: "key_rejected", message: check.message }, 422);
  await putKey(c.env, c.var.user!.id, source, key);
  return c.json({ ok: true, last4: key.slice(-4) });
});

keys.delete("/:source", async (c) => {
  const source = c.req.param("source");
  if (!isKeySource(source)) return c.json({ error: "bad_request" }, 400);
  await removeKey(c.env.DB, c.var.user!.id, source);
  return c.json({ ok: true });
});
