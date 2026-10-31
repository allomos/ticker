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

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: "application/json" } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "error", body.retryAfter);
  return body as T;
}

export async function send<T>(method: string, path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error", data.retryAfter);
  return data as T;
}

export interface Me {
  email: string;
}

export const api = {
  me: () => get<{ user: Me | null }>("/auth/me").then((r) => r.user),
  requestLink: (email: string) => send<{ ok: true; local: boolean }>("POST", "/auth/email", { email }),
  verify: (token: string) => send<{ user: Me }>("POST", "/auth/verify", { token }).then((r) => r.user),
  signOut: () => send<{ ok: true }>("POST", "/auth/signout"),
  search: (q: string, signal?: AbortSignal) =>
    get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`, signal).then((r) => r.results),
  quote: (symbol: string, signal?: AbortSignal) =>
    get<Cached<Quote>>(`/api/quote?symbol=${encodeURIComponent(symbol)}`, signal),
  quotes: (symbols: string[], signal?: AbortSignal) =>
    get<QuotesResponse>(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(",")}`, signal),
  chart: (symbol: string, range: Range, signal?: AbortSignal) =>
    get<Cached<Series>>(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`, signal),
};
