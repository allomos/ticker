import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { WatchList } from "../../src/shared/lists";
import type { SearchResult } from "../../src/shared/market";
import { quote } from "./fixtures";

vi.mock("../../src/app/components/PriceChart", () => ({ PriceChart: () => <div data-testid="chart" /> }));

const apple: SearchResult = { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", country: "United States", currency: "USD", type: "stock", typeLabel: "Common Stock", available: true };

let signedIn: boolean;
let lists: WatchList[];

beforeEach(() => {
  signedIn = true;
  lists = [
    { id: "l1", name: "Watchlist", items: [] },
    { id: "l2", name: "Tech stocks", items: [{ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock", addedAt: "" }] },
  ];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/auth/me") return Response.json({ user: signedIn ? { email: "ann@example.com" } : null });
    if (url.pathname === "/api/lists") return Response.json({ lists });
    if (url.pathname === "/api/quotes") return Response.json({ quotes: { AAPL: { data: quote("AAPL"), fetchedAt: "", stale: false } }, pending: [], unavailable: [] });
    if (url.pathname === "/api/quote") return Response.json({ data: quote("AAPL"), fetchedAt: "", stale: false });
    if (url.pathname === "/api/chart") return Response.json({ data: { symbol: "AAPL", range: "1D", timezone: "America/New_York", points: [] }, fetchedAt: "", stale: false });
    if (url.pathname === "/api/search") return Response.json({ results: [apple] });
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

const trail = async () => {
  const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
  await screen.findByRole("heading", { name: "AAPL name" });
  return within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
};

describe("ticker page breadcrumb", () => {
  it("names the list the ticker was opened from and goes back to it", async () => {
    history.replaceState(null, "", "/?list=l2");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "AAPL" }));
    expect(window.location.pathname + window.location.search).toBe("/quote/AAPL?list=l2");
    await waitFor(async () => expect(await trail()).toEqual([["Home", "/"], ["Tech stocks", "/?list=l2"]]));

    fireEvent.click(screen.getByRole("link", { name: "Tech stocks" }));
    expect(window.location.pathname + window.location.search).toBe("/?list=l2");
    expect((await screen.findByRole("tab", { name: /Tech stocks/ })).getAttribute("aria-selected")).toBe("true");
  });

  it("goes home from Home", async () => {
    history.replaceState(null, "", "/quote/AAPL?list=l2");
    render(<App />);
    await waitFor(async () => expect((await trail()).length).toBe(2));
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(window.location.pathname + window.location.search).toBe("/");
  });

  it("shows the search it came from, from the results page and from the search box", async () => {
    history.replaceState(null, "", "/search?q=apple");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: /AAPL.*Apple Inc\./ }));
    expect(window.location.search).toBe("?q=apple");
    expect(await trail()).toEqual([["Home", "/"], ["Search: “apple”", "/search?q=apple"]]);

    fireEvent.change(screen.getByRole("combobox", { name: "Search by name or ticker" }), { target: { value: "appl" } });
    fireEvent.click((await within(await screen.findByRole("listbox")).findAllByRole("option"))[0]);
    await waitFor(() => expect(window.location.search).toBe("?q=appl"));
    expect(await trail()).toEqual([["Home", "/"], ["Search: “appl”", "/search?q=appl"]]);
  });

  it("shows just Home for a direct link, an unknown list, or a signed-out user", async () => {
    history.replaceState(null, "", "/quote/AAPL");
    const { unmount } = render(<App />);
    expect(await trail()).toEqual([["Home", "/"]]);
    unmount();

    history.replaceState(null, "", "/quote/AAPL?list=gone");
    const second = render(<App />);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u) === "/api/lists")).toBe(true));
    expect(await trail()).toEqual([["Home", "/"]]);
    second.unmount();

    signedIn = false;
    history.replaceState(null, "", "/quote/AAPL?list=l2");
    render(<App />);
    expect(await trail()).toEqual([["Home", "/"]]);
  });

  it("keeps the trail through back and forward", async () => {
    history.replaceState(null, "", "/?list=l2");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "AAPL" }));
    await waitFor(async () => expect((await trail())[1]).toEqual(["Tech stocks", "/?list=l2"]));
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    await act(async () => {
      history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(() => expect(window.location.search).toBe("?list=l2"));
    await waitFor(async () => expect((await trail())[1]).toEqual(["Tech stocks", "/?list=l2"]));
  });
});
