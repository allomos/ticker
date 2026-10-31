import type { Quote } from "../../src/shared/market";

export const quote = (symbol: string): Quote => ({
  symbol, name: `${symbol} name`, exchange: "NASDAQ", currency: "USD", price: 344.63, change: -4.28, changePercent: -1.22668,
  open: 346.72, high: 349.19, low: 334.35, previousClose: 348.91, volume: 67797500, averageVolume: 42129920,
  fiftyTwoWeekLow: 243.42, fiftyTwoWeekHigh: 351.73, isMarketOpen: false, asOf: "2026-10-30T19:59:00.000Z",
});
