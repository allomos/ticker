import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { WatchList } from "../../src/shared/lists";
import { quote } from "./fixtures";

let lists: WatchList[];
let calls: { method: string; path: string; body: any }[];
let pendingOnce: Set<string>;

beforeEach(() => {
  history.replaceState(null, "", "/");
  calls = [];
  pendingOnce = new Set();
  lists = [
    {
      id: "l1",
      name: "Watchlist",
      items: [
        { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock", addedAt: "" },
        { symbol: "BTC/USD", name: "Bitcoin US Dollar", exchange: "Crypto", type: "crypto", addedAt: "" },
      ],
    },
    { id: "l2", name: "Tech", items: [] },
  ];
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: decodeURIComponent(url.pathname), body });
    if (url.pathname === "/auth/me") return Response.json({ user: { email: "ann@example.com" } });
    if (url.pathname === "/api/lists" && method === "GET") return Response.json({ lists });
    if (url.pathname === "/api/lists" && method === "POST") return Response.json({ list: { id: "l3", name: body.name, items: [] } }, { status: 201 });
    if (url.pathname === "/api/quotes") {
      const symbols = (url.searchParams.get("symbols") ?? "").split(",").map(decodeURIComponent);
      const ready = symbols.filter((s) => !pendingOnce.has(s));
      const pending = symbols.filter((s) => pendingOnce.has(s));
      pending.forEach((s) => pendingOnce.delete(s));
      return Response.json({
        quotes: Object.fromEntries(ready.map((s) => [s, { data: quote(s), fetchedAt: "", stale: false }])),
        pending,
        unavailable: [],
      });
    }
    return Response.json({ ok: true });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("lists page", () => {
  it("shows each ticker with its price and the day's change", async () => {
    render(<App />);
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getAllByText("344.63")).toHaveLength(2));
    expect(within(table).getByText("AAPL")).toBeTruthy();
    expect(within(table).getByText("BTC/USD")).toBeTruthy();
    expect(within(table).getAllByText("−4.28 (−1.23%)")[0].className).toContain("down");
    expect(screen.getByRole("tab", { name: /Watchlist/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows a price held back by the data plan as waiting", async () => {
    pendingOnce.add("BTC/USD");
    render(<App />);
    await screen.findByRole("table");
    expect(await screen.findByTitle("Waiting for the free data plan's limit")).toBeTruthy();
  });

  it("switches lists and says when one is empty", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: /Tech/ }));
    expect(await screen.findByText(/This list is empty/)).toBeTruthy();
    expect(window.location.search).toBe("?list=l2");
  });

  it("creates, renames and deletes lists", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "+ New list" }));
    fireEvent.change(screen.getByLabelText("New list name"), { target: { value: "Crypto" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("tab", { name: /Crypto/ })).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/lists")?.body).toEqual({ name: "Crypto" });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("List name"), { target: { value: "Coins" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("tab", { name: /Coins/ })).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ path: "/api/lists/l3", body: { name: "Coins" } });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: /Coins/ })).toBeNull());
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/lists/l3")).toBe(true);
  });

  it("removes a ticker from the list", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove BTC/USD from Watchlist" }));
    await waitFor(() => expect(screen.queryByText("BTC/USD")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/lists/l1/items/BTC/USD")).toBe(true);
  });

  it("opens a ticker from its row", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Apple Inc."));
    expect(window.location.pathname).toBe("/quote/AAPL");
  });
});
