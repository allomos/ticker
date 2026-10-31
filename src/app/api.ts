import type { WatchList } from "../shared/lists";
import { keyHeaders, type KeySource } from "./browserKeys";
import type { Locale } from "../shared/locale";
import type { Cached, InstrumentType, Quote, QuotesResponse, Range, SearchResult, Series } from "../shared/market";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: number,
    readonly triesLeft?: number,
    readonly detail?: string,
  ) {
    super(code);
  }
}

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: "application/json", ...keyHeaders() } });
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
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error", data.retryAfter, data.triesLeft, data.message);
  return data as T;
}

export interface ServerKey {
  source: KeySource;
  last4: string;
}

export interface Me {
  email: string;
}

export const api = {
  me: () => get<{ user: Me | null }>("/auth/me").then((r) => r.user),
  requestLink: (email: string, lang: Locale) => send<{ ok: true; local: boolean }>("POST", "/auth/email", { email, lang }),
  verify: (token: string, lang: Locale) => send<{ user: Me }>("POST", "/auth/verify", { token, lang }).then((r) => r.user),
  signInWithCode: (email: string, code: string, lang: Locale) =>
    send<{ user: Me }>("POST", "/auth/code", { email, code, lang }).then((r) => r.user),
  keys: () => get<{ keys: ServerKey[] }>("/api/keys").then((r) => r.keys),
  checkKey: (source: KeySource, key: string) => send<{ ok: boolean; message?: string }>("POST", "/api/keys/check", { source, key }),
  saveKey: (source: KeySource, key: string) => send<{ ok: true; last4: string }>("PUT", `/api/keys/${source}`, { key }),
  removeKey: (source: KeySource) => send<{ ok: true }>("DELETE", `/api/keys/${source}`),
  signOut: () => send<{ ok: true }>("POST", "/auth/signout"),
  lists: () => get<{ lists: WatchList[] }>("/api/lists").then((r) => r.lists),
  createList: (name: string) => send<{ list: WatchList }>("POST", "/api/lists", { name }).then((r) => r.list),
  renameList: (id: string, name: string) => send<{ ok: true }>("PATCH", `/api/lists/${id}`, { name }),
  deleteList: (id: string) => send<{ ok: true }>("DELETE", `/api/lists/${id}`),
  orderLists: (ids: string[]) => send<{ lists: WatchList[] }>("POST", "/api/lists/order", { ids }).then((r) => r.lists),
  addItem: (id: string, item: { symbol: string; name: string; exchange: string; type: InstrumentType }) =>
    send<{ ok: true }>("POST", `/api/lists/${id}/items`, item),
  removeItem: (id: string, symbol: string) => send<{ ok: true }>("DELETE", `/api/lists/${id}/items/${encodeURIComponent(symbol)}`),
  search: (q: string, signal?: AbortSignal) =>
    get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`, signal).then((r) => r.results),
  quote: (symbol: string, signal?: AbortSignal) =>
    get<Cached<Quote>>(`/api/quote?symbol=${encodeURIComponent(symbol)}`, signal),
  quotes: (symbols: string[], signal?: AbortSignal) =>
    get<QuotesResponse>(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(",")}`, signal),
  chart: (symbol: string, range: Range, signal?: AbortSignal) =>
    get<Cached<Series>>(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`, signal),
};
