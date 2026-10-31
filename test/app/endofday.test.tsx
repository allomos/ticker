import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { quote } from "./fixtures";

vi.mock("../../src/app/components/PriceChart", () => ({
  PriceChart: ({ series }: { series: { range: string } }) => <div data-testid="chart">{series.range}</div>,
}));

let chartRanges: string[];
beforeEach(() => {
  chartRanges = [];
  history.replaceState(null, "", "/quote/600519.SHH");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/auth/me") return Response.json({ user: { email: "owner@example.com" } });
    if (url.pathname === "/api/lists") return Response.json({ lists: [] });
    if (url.pathname === "/api/quote") {
      return Response.json({ data: { ...quote("600519.SHH"), name: "Kweichow Moutai", endOfDay: true, asOf: "2026-10-30T07:00:00.000Z" }, fetchedAt: "", stale: false });
    }
    if (url.pathname === "/api/chart") {
      chartRanges.push(url.searchParams.get("range")!);
      return Response.json({ data: { symbol: "600519.SHH", range: url.searchParams.get("range"), interval: "1day", timezone: "Asia/Shanghai", points: [{ t: 1, c: 2 }] }, fetchedAt: "", stale: false });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("a Shanghai stock's page", () => {
  it("says the price is from the last close, opens on 1M and greys out ranges without daily data", async () => {
    render(<App />);
    expect(await screen.findByText(/End-of-day price, from the close on/)).toBeTruthy();
    expect(screen.queryByText(/Market closed/)).toBeNull();
    expect((await screen.findByTestId("chart")).textContent).toBe("1M");
    expect(chartRanges).toEqual(["1M"]);
    for (const r of ["1D", "1Y", "5Y", "Max"]) expect((screen.getByRole("tab", { name: r }) as HTMLButtonElement).disabled).toBe(true);
    for (const r of ["5D", "1M", "6M", "YTD"]) expect((screen.getByRole("tab", { name: r }) as HTMLButtonElement).disabled).toBe(false);
  });
});
