import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { SearchResult } from "../../src/shared/market";

const results: SearchResult[] = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", country: "United States", currency: "USD", type: "stock", typeLabel: "Common Stock", available: true },
  { symbol: "0R2V", name: "Apple Inc.", exchange: "LSE", country: "United Kingdom", currency: "USD", type: "stock", typeLabel: "Common Stock", available: false },
];

beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/auth/me") return Response.json({ user: null });
    if (url.pathname === "/api/search") return Response.json({ results: url.searchParams.get("q") ? results : [] });
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("search box", () => {
  it("suggests matches as you type, with uncovered listings marked", async () => {
    render(<App />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "apple" } });
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("AAPL");
    expect(options[0].textContent).toContain("NASDAQ");
    expect(options[1].getAttribute("aria-disabled")).toBe("true");
    expect(options[1].textContent).toContain("Not on free data");
  });

  it("opens the chosen ticker's page", async () => {
    render(<App />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "AAPL" } });
    const [first] = await screen.findAllByRole("option");
    fireEvent.click(first);
    expect(window.location.pathname).toBe("/quote/AAPL");
  });

  it("does not open an uncovered listing", async () => {
    render(<App />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "apple" } });
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[1]);
    expect(window.location.pathname).toBe("/");
  });

  it("goes to all results on Enter", async () => {
    render(<App />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "apple" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(window.location.pathname).toBe("/search");
    expect(await screen.findByText(/Results for/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Not on the free data plan")).toBeTruthy());
  });

  it("picks a suggestion with the arrow keys", async () => {
    render(<App />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "apple" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    expect(window.location.pathname).toBe("/quote/AAPL");
  });
});
