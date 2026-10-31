// Market data shapes shared by the Worker and the web app.

export type InstrumentType =
  | "stock"
  | "etf"
  | "fund"
  | "index"
  | "crypto"
  | "currency"
  | "other";

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  type: InstrumentType;
  typeLabel: string;
  /** Covered by the app's data plan; others are shown but cannot be opened. */
  available: boolean;
}

export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  averageVolume: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  isMarketOpen: boolean;
  /** When the price was last updated at the source (ISO 8601). */
  asOf: string;
}

export const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
export type Range = (typeof RANGES)[number];

export interface SeriesPoint {
  /** Unix seconds. */
  t: number;
  c: number;
}

export interface Series {
  symbol: string;
  range: Range;
  interval: string;
  timezone: string;
  points: SeriesPoint[];
}

/** A cached value with when it was fetched; `stale` when it is older than wanted. */
export interface Cached<T> {
  data: T;
  fetchedAt: string;
  stale: boolean;
}

export interface QuotesResponse {
  quotes: Record<string, Cached<Quote>>;
  /** Symbols with no price yet: asked again later, within the data plan's limits. */
  pending: string[];
  unavailable: string[];
}
