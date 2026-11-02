import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

let reason: string | undefined;
beforeEach(() => {
  reason = undefined;
  history.replaceState(null, "", "/quote/7203.T");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/auth/me") return Response.json({ user: { email: "ann@example.com" } });
    if (url.pathname === "/api/lists") return Response.json({ lists: [] });
    if (url.pathname === "/api/quote" || url.pathname === "/api/chart") return Response.json({ error: "unavailable", ...(reason ? { reason } : {}) }, { status: 404 });
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("a Tokyo stock's page", () => {
  it("offers only a Twelve Data key that covers Tokyo", async () => {
    render(<App />);
    expect(await screen.findByText(/Add your own Twelve Data API key, on a plan that covers Tokyo, to see it\./)).toBeTruthy();
    expect(screen.queryByText(/Alpha Vantage/)).toBeNull();
  });

  it("says when the user's own key's plan does not cover it", async () => {
    reason = "own_key";
    render(<App />);
    expect(await screen.findByText("Your own Twelve Data key's plan doesn't cover this stock.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add a key" })).toBeNull();
  });
});
