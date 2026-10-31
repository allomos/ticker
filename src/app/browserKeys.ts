// API keys the user chose to keep only in this browser: never stored on the server, sent with
// each request to the app's API (over HTTPS) and used for that request only.
export const KEY_SOURCES = ["twelvedata", "alphavantage"] as const;
export type KeySource = (typeof KEY_SOURCES)[number];

const STORAGE = "ticker.keys";

export function browserKeys(): Partial<Record<KeySource, string>> {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function setBrowserKey(source: KeySource, key: string | null) {
  const keys = browserKeys();
  if (key) keys[source] = key;
  else delete keys[source];
  try {
    localStorage.setItem(STORAGE, JSON.stringify(keys));
  } catch {
    // Storage refused (private window): the key cannot be kept here.
  }
}

/** The headers that carry this browser's keys. */
export function keyHeaders(): Record<string, string> {
  return Object.fromEntries(Object.entries(browserKeys()).map(([source, key]) => [`x-ticker-key-${source}`, key!]));
}
