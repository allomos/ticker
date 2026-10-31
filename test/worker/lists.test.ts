import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { app } from "../../src/worker/index";
import type { WatchList } from "../../src/shared/lists";
import { json, signIn } from "./auth-helpers";

const call = (cookie: string, method: string, path: string, body?: unknown) =>
  app.request(
    `http://localhost/api/lists${path}`,
    method === "GET" ? { headers: { cookie } } : { ...json(body ?? {}, { cookie }), method },
    env,
  );
const getLists = async (cookie: string) => ((await (await call(cookie, "GET", "")).json()) as { lists: WatchList[] }).lists;

const apple = { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock" };
const btc = { symbol: "BTC/USD", name: "Bitcoin US Dollar", exchange: "Crypto", type: "crypto" };

describe("lists", () => {
  it("need a signed-in user", async () => {
    expect((await app.request("http://localhost/api/lists", {}, env)).status).toBe(401);
  });

  it("start with one list for a new account", async () => {
    const me = await signIn("new@example.com");
    const lists = await getLists(me);
    expect(lists.map((l) => l.name)).toEqual(["Watchlist"]);
  });

  it("are created, renamed, reordered and deleted", async () => {
    const me = await signIn("lists@example.com");
    const tech = (await (await call(me, "POST", "", { name: "  Tech   stocks " })).json()) as { list: WatchList };
    expect(tech.list.name).toBe("Tech stocks");
    const crypto = ((await (await call(me, "POST", "", { name: "Crypto" })).json()) as { list: WatchList }).list;
    expect((await call(me, "PATCH", `/${crypto.id}`, { name: "Coins" })).status).toBe(200);
    let lists = await getLists(me);
    expect(lists.map((l) => l.name)).toEqual(["Watchlist", "Tech stocks", "Coins"]);
    await call(me, "POST", "/order", { ids: [crypto.id, tech.list.id, lists[0].id] });
    lists = await getLists(me);
    expect(lists.map((l) => l.name)).toEqual(["Coins", "Tech stocks", "Watchlist"]);
    expect((await call(me, "DELETE", `/${tech.list.id}`)).status).toBe(200);
    expect((await getLists(me)).map((l) => l.name)).toEqual(["Coins", "Watchlist"]);
    expect((await call(me, "POST", "", { name: "   " })).status).toBe(400);
  });

  it("hold tickers, added once and removed", async () => {
    const me = await signIn("items@example.com");
    const [list] = await getLists(me);
    await call(me, "POST", `/${list.id}/items`, apple);
    await call(me, "POST", `/${list.id}/items`, btc);
    await call(me, "POST", `/${list.id}/items`, apple);
    let [l] = await getLists(me);
    expect(l.items.map((i) => i.symbol)).toEqual(["AAPL", "BTC/USD"]);
    expect(l.items[1]).toMatchObject({ name: "Bitcoin US Dollar", type: "crypto" });
    expect((await call(me, "DELETE", `/${list.id}/items/${encodeURIComponent("BTC/USD")}`)).status).toBe(200);
    [l] = await getLists(me);
    expect(l.items.map((i) => i.symbol)).toEqual(["AAPL"]);
    expect((await call(me, "POST", `/${list.id}/items`, { symbol: "<b>" })).status).toBe(400);
  });

  it("deleting a list deletes its tickers", async () => {
    const me = await signIn("cascade@example.com");
    const [list] = await getLists(me);
    await call(me, "POST", `/${list.id}/items`, apple);
    await call(me, "DELETE", `/${list.id}`);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM list_items WHERE list_id = ?1").bind(list.id).first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("are private: another user can neither see nor change them", async () => {
    const ann = await signIn("ann.private@example.com");
    const bob = await signIn("bob.private@example.com");
    const [annList] = await getLists(ann);
    await call(ann, "POST", `/${annList.id}/items`, apple);

    const bobLists = await getLists(bob);
    expect(bobLists.some((l) => l.id === annList.id)).toBe(false);
    expect(bobLists.flatMap((l) => l.items)).toEqual([]);

    expect((await call(bob, "PATCH", `/${annList.id}`, { name: "Mine now" })).status).toBe(404);
    expect((await call(bob, "DELETE", `/${annList.id}`)).status).toBe(404);
    expect((await call(bob, "POST", `/${annList.id}/items`, btc)).status).toBe(404);
    expect((await call(bob, "DELETE", `/${annList.id}/items/AAPL`)).status).toBe(404);
    await call(bob, "POST", "/order", { ids: [annList.id] });

    const [after] = await getLists(ann);
    expect(after).toMatchObject({ id: annList.id, name: "Watchlist" });
    expect(after.items.map((i) => i.symbol)).toEqual(["AAPL"]);
  });
});
