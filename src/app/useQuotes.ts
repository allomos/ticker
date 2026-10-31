import { useEffect, useState } from "react";
import type { Cached, Quote } from "../shared/market";
import { api } from "./api";

export interface QuoteState {
  quotes: Record<string, Cached<Quote>>;
  pending: Set<string>;
  unavailable: Set<string>;
}

const POLL_PENDING = 20_000;
const POLL_FRESH = 5 * 60_000;

/**
 * Prices for several symbols. Those the data plan's limit holds back come later: asked again
 * every 20 seconds while any are missing, and every 5 minutes otherwise.
 */
export function useQuotes(symbols: string[]): QuoteState {
  const key = [...symbols].sort().join(",");
  const [state, setState] = useState<QuoteState>({ quotes: {}, pending: new Set(symbols), unavailable: new Set() });

  useEffect(() => {
    if (!key) {
      setState({ quotes: {}, pending: new Set(), unavailable: new Set() });
      return;
    }
    const wanted = key.split(",");
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      let delay = POLL_FRESH;
      try {
        const r = await api.quotes(wanted, ctrl.signal);
        setState((s) => ({
          quotes: { ...s.quotes, ...r.quotes },
          pending: new Set(r.pending),
          unavailable: new Set(r.unavailable),
        }));
        if (r.pending.length) delay = POLL_PENDING;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        delay = POLL_PENDING;
      }
      timer = setTimeout(load, delay);
    };
    setState((s) => ({ ...s, pending: new Set(wanted.filter((w) => !s.quotes[w])) }));
    load();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [key]);

  return state;
}
