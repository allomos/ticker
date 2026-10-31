import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { quote } from "./fixtures";

vi.mock("../../src/app/components/PriceChart", () => ({ PriceChart: () => <div data-testid="chart" /> }));

let signedIn: boolean;
let serverKeys: { source: string; last4: string }[];
let requests: { method: string; path: string; body: any; headers: Record<string, string> }[];
let quoteStatus: number;

beforeEach(() => {
  signedIn = true;
  serverKeys = [];
  requests = [];
  quoteStatus = 404;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path: url.pathname, body, headers: (init?.headers as Record<string, string>) ?? {} });
    if (url.pathname === "/auth/me") return Response.json({ user: signedIn ? { email: "ann@example.com" } : null });
    if (url.pathname === "/api/lists") {
      return Response.json({ lists: [{ id: "l1", name: "Watchlist", items: [{ symbol: "7203", name: "Toyota", exchange: "TSE", type: "stock", addedAt: "" }, { symbol: "AAPL", name: "Apple", exchange: "NASDAQ", type: "stock", addedAt: "" }] }] });
    }
    if (url.pathname === "/api/quotes") return Response.json({ quotes: { AAPL: { data: quote("AAPL"), fetchedAt: "", stale: false } }, pending: [], unavailable: ["7203"] });
    if (url.pathname === "/api/quote") {
      if (quoteStatus === 503) return Response.json({ error: "busy", retryAfter: 20 }, { status: 503 });
      return Response.json({ error: "unavailable" }, { status: 404 });
    }
    if (url.pathname === "/api/search") {
      return Response.json({ results: [{ symbol: "7203", name: "Toyota Motor Corp", exchange: "TSE", country: "Japan", currency: "JPY", type: "stock", typeLabel: "Common Stock", available: false }] });
    }
    if (url.pathname === "/api/keys" && method === "GET") return Response.json({ keys: serverKeys });
    if (url.pathname === "/api/keys/check") return Response.json(body.key === "bad" ? { ok: false, message: "invalid key" } : { ok: true });
    const keyPath = url.pathname.match(/^\/api\/keys\/(\w+)$/);
    if (keyPath && method === "PUT") {
      if (body.key === "bad") return Response.json({ error: "key_rejected", message: "invalid key" }, { status: 422 });
      serverKeys = [...serverKeys.filter((k) => k.source !== keyPath[1]), { source: keyPath[1], last4: body.key.slice(-4) }];
      return Response.json({ ok: true, last4: body.key.slice(-4) });
    }
    if (keyPath && method === "DELETE") {
      serverKeys = serverKeys.filter((k) => k.source !== keyPath[1]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

const card = (name: string) => screen.getByRole("region", { name });

describe("prompts to add a key", () => {
  it("on a stock the free plan does not cover, linking to the keys page", async () => {
    history.replaceState(null, "", "/quote/7203");
    render(<App />);
    expect(await screen.findByText("This stock isn't on the free data plan.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add a key" }).getAttribute("href")).toBe("/account/keys");
  });

  it("sends visitors who aren't signed in to sign in first", async () => {
    signedIn = false;
    history.replaceState(null, "", "/quote/7203");
    render(<App />);
    expect((await screen.findByRole("link", { name: "Add a key" })).getAttribute("href")).toBe("/signin");
  });

  it("under the busy note", async () => {
    quoteStatus = 503;
    history.replaceState(null, "", "/quote/MSFT");
    render(<App />);
    expect(await screen.findByText(/Or add your own Twelve Data or Alpha Vantage API key to skip the wait\./)).toBeTruthy();
  });

  it("once above search results and a list that hold such stocks", async () => {
    history.replaceState(null, "", "/search?q=toyota");
    const { unmount } = render(<App />);
    await screen.findByText("Toyota Motor Corp");
    expect(screen.getAllByText("This stock isn't on the free data plan.")).toHaveLength(1);
    unmount();
    history.replaceState(null, "", "/");
    render(<App />);
    await screen.findByText("Toyota");
    expect(await screen.findAllByText("This stock isn't on the free data plan.")).toHaveLength(1);
  });
});

describe("the keys page", () => {
  beforeEach(() => history.replaceState(null, "", "/account/keys"));

  it("checks and keeps a key on the server, shown masked, and removes it", async () => {
    render(<App />);
    const td = await screen.findByRole("region", { name: "Twelve Data" });
    fireEvent.click(within(td).getByRole("button", { name: "Add a key" }));
    fireEvent.change(within(td).getByLabelText("API key"), { target: { value: "td-key-0001" } });
    expect((within(td).getByRole("radio", { name: /On the server, encrypted/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(td).getByRole("button", { name: "Check and add" }));
    expect(await within(card("Twelve Data")).findByText("On the server, encrypted · ending in 0001")).toBeTruthy();
    expect(requests.find((r) => r.method === "PUT")?.body).toEqual({ key: "td-key-0001" });
    fireEvent.click(within(card("Twelve Data")).getByRole("button", { name: "Remove" }));
    expect(await within(card("Twelve Data")).findByText("No key added")).toBeTruthy();
  });

  it("keeps a key only in this browser and sends it with the app's requests", async () => {
    render(<App />);
    const av = await screen.findByRole("region", { name: "Alpha Vantage" });
    fireEvent.click(within(av).getByRole("button", { name: "Add a key" }));
    fireEvent.change(within(av).getByLabelText("API key"), { target: { value: "av-key-0002" } });
    fireEvent.click(within(av).getByRole("radio", { name: /Only in this browser/ }));
    fireEvent.click(within(av).getByRole("button", { name: "Check and add" }));
    expect(await within(card("Alpha Vantage")).findByText("Only in this browser · ending in 0002")).toBeTruthy();
    expect(requests.some((r) => r.method === "PUT")).toBe(false);
    expect(JSON.parse(localStorage.getItem("ticker.keys")!)).toEqual({ alphavantage: "av-key-0002" });
    await waitFor(() => expect(requests.filter((r) => r.path === "/api/keys" && r.method === "GET").at(-1)?.headers["x-ticker-key-alphavantage"]).toBe("av-key-0002"));
    // Moving it to the server sends it once and forgets it here.
    fireEvent.click(within(card("Alpha Vantage")).getByRole("button", { name: "Keep on the server" }));
    expect(await within(card("Alpha Vantage")).findByText("On the server, encrypted · ending in 0002")).toBeTruthy();
    expect(localStorage.getItem("ticker.keys")).toBe("{}");
  });

  it("moves a server key to this browser when it is pasted again", async () => {
    serverKeys = [{ source: "twelvedata", last4: "0001" }];
    render(<App />);
    fireEvent.click(await within(await screen.findByRole("region", { name: "Twelve Data" })).findByRole("button", { name: "Keep only in this browser" }));
    expect(screen.getByText(/Paste the key again to keep it only in this browser/)).toBeTruthy();
    fireEvent.change(within(card("Twelve Data")).getByLabelText("API key"), { target: { value: "td-key-0001" } });
    fireEvent.click(within(card("Twelve Data")).getByRole("button", { name: "Check and add" }));
    expect(await within(card("Twelve Data")).findByText("Only in this browser · ending in 0001")).toBeTruthy();
    expect(serverKeys).toEqual([]);
  });

  it("says when a key does not work", async () => {
    render(<App />);
    const td = await screen.findByRole("region", { name: "Twelve Data" });
    fireEvent.click(within(td).getByRole("button", { name: "Add a key" }));
    fireEvent.change(within(td).getByLabelText("API key"), { target: { value: "bad" } });
    fireEvent.click(within(td).getByRole("button", { name: "Check and add" }));
    expect(await within(card("Twelve Data")).findByText("This key does not work: invalid key")).toBeTruthy();
  });

  it("is in the account menu", async () => {
    history.replaceState(null, "", "/");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Account: ann@example.com" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Your API keys" }));
    expect(await screen.findByRole("heading", { name: "Your API keys" })).toBeTruthy();
  });
});
