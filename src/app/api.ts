import type { Cached, Quote, QuotesResponse, Range, SearchResult, Series } from "../shared/market";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: number,
  ) {
    super(code);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: "application/json" } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "error", body.retryAfter);
  return body as T;
}

export const api = {
  search: (q: string, signal?: AbortSignal) =>
    get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`, signal).then((r) => r.results),
  quote: (symbol: string, signal?: AbortSignal) =>
    get<Cached<Quote>>(`/api/quote?symbol=${encodeURIComponent(symbol)}`, signal),
  quotes: (symbols: string[], signal?: AbortSignal) =>
    get<QuotesResponse>(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(",")}`, signal),
  chart: (symbol: string, range: Range, signal?: AbortSignal) =>
    get<Cached<Series>>(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`, signal),
};
