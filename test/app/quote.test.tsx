import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { Quote } from "../../src/shared/market";

vi.mock("../../src/app/components/PriceChart", () => ({
  PriceChart: ({ series }: { series: { range: string; points: unknown[] } }) => <div data-testid="chart">{`${series.range}:${series.points.length}`}</div>,
}));

const quote: Quote = {
  symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD", price: 344.63, change: -4.28, changePercent: -1.22668,
  open: 346.72, high: 349.19, low: 334.35, previousClose: 348.91, volume: 67797500, averageVolume: 42129920,
  fiftyTwoWeekLow: 243.42, fiftyTwoWeekHigh: 351.73, isMarketOpen: false, asOf: "2026-10-30T19:59:00.000Z",
};

let quoteStatus = 200;
beforeEach(() => {
  quoteStatus = 200;
  history.replaceState(null, "", "/quote/AAPL");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/auth/me") return Response.json({ user: null });
    if (url.pathname === "/api/quote") {
      if (quoteStatus === 404) return Response.json({ error: "unavailable" }, { status: 404 });
      if (quoteStatus === 503) return Response.json({ error: "busy", retryAfter: 12 }, { status: 503 });
      return Response.json({ data: quote, fetchedAt: "2026-10-31T10:00:00Z", stale: false });
    }
    if (url.pathname === "/api/chart") {
      const range = url.searchParams.get("range");
      const n = range === "1D" ? 78 : 22;
      return Response.json({ data: { symbol: "AAPL", range, interval: "x", timezone: "America/New_York", points: Array.from({ length: n }, (_, i) => ({ t: 1793000000 + i * 300, c: 340 + i / 10 })) }, fetchedAt: "", stale: false });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("ticker page", () => {
  it("shows the price, the day's change, key figures and a chart", async () => {
    render(<App />);
    expect(await screen.findByText("Apple Inc.")).toBeTruthy();
    expect(screen.getByText("344.63")).toBeTruthy();
    expect(screen.getByText("−4.28 (−1.23%)").className).toContain("down");
    expect(screen.getByText("Previous close").nextSibling?.textContent).toBe("348.91");
    expect(screen.getByText("52-week range").nextSibling?.textContent).toBe("243.42 – 351.73");
    expect(screen.getByText("Volume").nextSibling?.textContent).toBe("67.8M");
    expect(screen.getByText(/Market closed · Price as of/)).toBeTruthy();
    expect((await screen.findByTestId("chart")).textContent).toBe("1D:78");
  });

  it("loads another range", async () => {
    render(<App />);
    await screen.findByTestId("chart");
    fireEvent.click(screen.getByRole("tab", { name: "1Y" }));
    await waitFor(() => expect(screen.getByTestId("chart").textContent).toBe("1Y:22"));
  });

  it("says so when the plan does not cover the symbol", async () => {
    quoteStatus = 404;
    render(<App />);
    expect(await screen.findByText(/does not cover AAPL/)).toBeTruthy();
  });

  it("says when the plan's limit is reached and when it will retry", async () => {
    quoteStatus = 503;
    render(<App />);
    expect(await screen.findByText(/loads by itself in about 12 seconds/)).toBeTruthy();
  });
});
