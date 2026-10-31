import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { WatchList } from "../../src/shared/lists";
import type { SearchResult } from "../../src/shared/market";
import { quote } from "./fixtures";

vi.mock("../../src/app/components/PriceChart", () => ({ PriceChart: () => <div /> }));

const vooResult: SearchResult = { symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE", country: "United States", currency: "USD", type: "etf", typeLabel: "ETF", available: true };
let signedIn: boolean;
let lists: WatchList[];
let calls: { method: string; path: string; body: any }[];

beforeEach(() => {
  signedIn = true;
  calls = [];
  lists = [
    { id: "l1", name: "Watchlist", items: [] },
    { id: "l2", name: "Funds", items: [] },
  ];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: decodeURIComponent(url.pathname), body });
    if (url.pathname === "/auth/me") return Response.json({ user: signedIn ? { email: "ann@example.com" } : null });
    if (url.pathname === "/api/lists" && method === "GET") return Response.json({ lists });
    if (url.pathname === "/api/lists" && method === "POST") return Response.json({ list: { id: "l3", name: body.name, items: [] } }, { status: 201 });
    if (url.pathname === "/api/search") return Response.json({ results: [vooResult] });
    if (url.pathname === "/api/quote") return Response.json({ data: { ...quote("VOO"), name: "Vanguard S&P 500 ETF", exchange: "NYSE" }, fetchedAt: "", stale: false });
    if (url.pathname === "/api/chart") return Response.json({ data: { symbol: "VOO", range: "1D", interval: "5min", timezone: "UTC", points: [] }, fetchedAt: "", stale: false });
    return Response.json({ ok: true });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("add to list", () => {
  it("from a ticker's page: tick a list to add, untick to remove", async () => {
    history.replaceState(null, "", "/quote/VOO");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "☆ Add to list" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Funds" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/lists/l2/items")).toBe(true));
    // The type comes from search, since a quote does not say it.
    expect(calls.find((c) => c.path === "/api/lists/l2/items")?.body).toEqual({ symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE", type: "etf" });
    expect(await screen.findByRole("button", { name: "★ In Funds" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Funds" }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Funds" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/lists/l2/items/VOO")).toBe(true));
    expect(await screen.findByRole("button", { name: "☆ Add to list" })).toBeTruthy();
  });

  it("into a new list", async () => {
    history.replaceState(null, "", "/quote/VOO");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "☆ Add to list" }));
    fireEvent.click(screen.getByRole("button", { name: "+ New list" }));
    fireEvent.change(screen.getByLabelText("New list name"), { target: { value: "ETFs" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/lists/l3/items")).toBe(true));
    expect(await screen.findByRole("button", { name: "★ In ETFs" })).toBeTruthy();
  });

  it("from search results", async () => {
    history.replaceState(null, "", "/search?q=voo");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Add VOO to a list" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Watchlist" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/lists/l1/items")?.body).toMatchObject({ symbol: "VOO", type: "etf" }));
    // Adding did not open the ticker's page.
    expect(window.location.pathname).toBe("/search");
  });

  it("asks a signed-out user to sign in", async () => {
    signedIn = false;
    history.replaceState(null, "", "/quote/VOO");
    render(<App />);
    expect(await screen.findByRole("link", { name: "☆ Sign in to add to a list" })).toBeTruthy();
  });
});
