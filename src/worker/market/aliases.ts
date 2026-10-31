// Twelve Data's search finds crypto and currency pairs only by their symbols ("BTC/USD"),
// not by name ("bitcoin"). These names lead to the common pairs.
import type { SearchResult } from "../../shared/market";

const CRYPTO: [string, string, string[]][] = [
  ["BTC/USD", "Bitcoin US Dollar", ["bitcoin", "btc"]],
  ["ETH/USD", "Ethereum US Dollar", ["ethereum", "ether", "eth"]],
  ["SOL/USD", "Solana US Dollar", ["solana", "sol"]],
  ["XRP/USD", "XRP US Dollar", ["xrp", "ripple"]],
  ["BNB/USD", "BNB US Dollar", ["bnb", "binance coin"]],
  ["DOGE/USD", "Dogecoin US Dollar", ["dogecoin", "doge"]],
  ["ADA/USD", "Cardano US Dollar", ["cardano", "ada"]],
  ["LTC/USD", "Litecoin US Dollar", ["litecoin", "ltc"]],
  ["DOT/USD", "Polkadot US Dollar", ["polkadot", "dot"]],
  ["AVAX/USD", "Avalanche US Dollar", ["avalanche", "avax"]],
  ["LINK/USD", "Chainlink US Dollar", ["chainlink", "link"]],
  ["USDT/USD", "Tether US Dollar", ["tether", "usdt"]],
];

const CURRENCY: [string, string, string[]][] = [
  ["EUR/USD", "Euro / US Dollar", ["euro", "eur"]],
  ["USD/JPY", "US Dollar / Japanese Yen", ["yen", "japanese yen", "jpy"]],
  ["GBP/USD", "British Pound / US Dollar", ["pound", "sterling", "gbp"]],
  ["USD/CNY", "US Dollar / Chinese Yuan", ["yuan", "renminbi", "cny"]],
  ["USD/CHF", "US Dollar / Swiss Franc", ["swiss franc", "franc", "chf"]],
  ["AUD/USD", "Australian Dollar / US Dollar", ["australian dollar", "aud"]],
  ["USD/CAD", "US Dollar / Canadian Dollar", ["canadian dollar", "cad"]],
  ["USD/KRW", "US Dollar / South Korean Won", ["won", "korean won", "krw"]],
  ["XAU/USD", "Gold Spot / US Dollar", ["gold", "xau"]],
  ["XAG/USD", "Silver Spot / US Dollar", ["silver", "xag"]],
];

function row(symbol: string, name: string, type: "crypto" | "currency"): SearchResult {
  return {
    symbol,
    name,
    exchange: type === "crypto" ? "Crypto" : "Currency",
    country: "",
    currency: symbol.split("/")[1],
    type,
    typeLabel: type === "crypto" ? "Digital Currency" : "Physical Currency",
    available: true,
  };
}

/** Pairs whose name starts with the query (at least 3 letters, or an exact short name). */
export function aliasMatches(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: SearchResult[] = [];
  for (const [list, type] of [[CRYPTO, "crypto"], [CURRENCY, "currency"]] as const) {
    for (const [symbol, name, names] of list) {
      if (names.some((n) => n === q || (q.length >= 3 && n.startsWith(q)))) out.push(row(symbol, name, type));
    }
  }
  return out;
}
