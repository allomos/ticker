// The signed-in user's lists. Every query is limited to lists the user owns; another user's list
// answers 404, as if it did not exist.
import { Hono } from "hono";
import { LIMITS, type ListItem, type WatchList } from "../../shared/lists";
import type { InstrumentType } from "../../shared/market";
import { requireUser, type AppEnv } from "../auth/session";

const SYMBOL = /^[A-Za-z0-9.\-/:^=]{1,24}$/;
const TYPES: InstrumentType[] = ["stock", "etf", "fund", "index", "crypto", "currency", "other"];
export const DEFAULT_LIST = "Watchlist";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Gives a new account its first list. */
export async function createDefaultList(db: D1Database, userId: string, now = Date.now()) {
  await db
    .prepare("INSERT INTO lists (id, user_id, name, position, created_at) VALUES (?1, ?2, ?3, 0, ?4)")
    .bind(crypto.randomUUID(), userId, DEFAULT_LIST, now)
    .run();
}

async function ownedList(db: D1Database, userId: string, listId: string) {
  return db.prepare("SELECT id FROM lists WHERE id = ?1 AND user_id = ?2").bind(listId, userId).first<{ id: string }>();
}

async function allLists(db: D1Database, userId: string): Promise<WatchList[]> {
  const [lists, items] = await db.batch([
    db.prepare("SELECT id, name FROM lists WHERE user_id = ?1 ORDER BY position, created_at").bind(userId),
    db
      .prepare(
        `SELECT i.list_id, i.symbol, i.name, i.exchange, i.type, i.added_at FROM list_items i
         JOIN lists l ON l.id = i.list_id WHERE l.user_id = ?1 ORDER BY i.position, i.added_at`,
      )
      .bind(userId),
  ]);
  const byList = new Map<string, ListItem[]>();
  for (const r of items.results as any[]) {
    const item: ListItem = { symbol: r.symbol, name: r.name, exchange: r.exchange, type: r.type, addedAt: new Date(r.added_at).toISOString() };
    byList.set(r.list_id, [...(byList.get(r.list_id) ?? []), item]);
  }
  return (lists.results as any[]).map((l) => ({ id: l.id, name: l.name, items: byList.get(l.id) ?? [] }));
}

export const lists = new Hono<AppEnv>();
lists.use("*", requireUser);

lists.get("/", async (c) => c.json({ lists: await allLists(c.env.DB, c.var.user!.id) }));

lists.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = clean(body?.name, LIMITS.name);
  if (!name) return c.json({ error: "name_required" }, 400);
  const userId = c.var.user!.id;
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS last FROM lists WHERE user_id = ?1")
    .bind(userId)
    .first<{ n: number; last: number }>();
  if ((count?.n ?? 0) >= LIMITS.lists) return c.json({ error: "too_many_lists" }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO lists (id, user_id, name, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(id, userId, name, (count?.last ?? -1) + 1, Date.now())
    .run();
  return c.json({ list: { id, name, items: [] } satisfies WatchList }, 201);
});

lists.post("/order", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length > LIMITS.lists) return c.json({ error: "bad_request" }, 400);
  const userId = c.var.user!.id;
  await c.env.DB.batch(
    ids.map((id, i) => c.env.DB.prepare("UPDATE lists SET position = ?1 WHERE id = ?2 AND user_id = ?3").bind(i, String(id), userId)),
  );
  return c.json({ lists: await allLists(c.env.DB, userId) });
});

lists.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = clean(body?.name, LIMITS.name);
  if (!name) return c.json({ error: "name_required" }, 400);
  const r = await c.env.DB.prepare("UPDATE lists SET name = ?1 WHERE id = ?2 AND user_id = ?3")
    .bind(name, c.req.param("id"), c.var.user!.id)
    .run();
  if (!r.meta.changes) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

lists.delete("/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM lists WHERE id = ?1 AND user_id = ?2").bind(c.req.param("id"), c.var.user!.id).run();
  if (!r.meta.changes) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

lists.post("/:id/items", async (c) => {
  const listId = c.req.param("id");
  if (!(await ownedList(c.env.DB, c.var.user!.id, listId))) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const symbol = String(body?.symbol ?? "");
  if (!SYMBOL.test(symbol)) return c.json({ error: "bad_symbol" }, 400);
  const type: InstrumentType = TYPES.includes(body?.type) ? body.type : "other";
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS last FROM list_items WHERE list_id = ?1")
    .bind(listId)
    .first<{ n: number; last: number }>();
  if ((count?.n ?? 0) >= LIMITS.items) return c.json({ error: "list_full" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO list_items (list_id, symbol, name, exchange, type, position, added_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT (list_id, symbol) DO NOTHING`,
  )
    .bind(listId, symbol, clean(body?.name, 120) || symbol, clean(body?.exchange, 40), type, (count?.last ?? -1) + 1, Date.now())
    .run();
  return c.json({ ok: true });
});

lists.delete("/:id/items/:symbol", async (c) => {
  const listId = c.req.param("id");
  if (!(await ownedList(c.env.DB, c.var.user!.id, listId))) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare("DELETE FROM list_items WHERE list_id = ?1 AND symbol = ?2").bind(listId, c.req.param("symbol")).run();
  return c.json({ ok: true });
});
