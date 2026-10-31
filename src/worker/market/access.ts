// Which key a request uses: the app's shared key, or a user's own. A user's key has its own
// pause after a limit answer and its own space in the cache, so what it fetches is served to
// that user only and other users are never affected.
import type { Env } from "../env";

export interface Access {
  /** The API key to send. */
  key: string;
  /** The api_pause row this key is paused in ("twelvedata", "alphavantage", or one per user key). */
  source: string;
  /** Put before cache keys: "" for the shared cache, "u:<user id>:" for a user's own key. */
  prefix: string;
  /** True for a user's own key (paid Twelve Data plans cover more than the free one). */
  own: boolean;
}

export function sharedTwelveData(env: Env): Access {
  if (!env.TWELVE_DATA_API_KEY) throw new Error("TWELVE_DATA_API_KEY is not set");
  return { key: env.TWELVE_DATA_API_KEY, source: "twelvedata", prefix: "", own: false };
}

export function sharedAlphaVantage(env: Env): Access {
  if (!env.ALPHA_VANTAGE_API_KEY) throw new Error("ALPHA_VANTAGE_API_KEY is not set");
  return { key: env.ALPHA_VANTAGE_API_KEY, source: "alphavantage", prefix: "", own: false };
}
