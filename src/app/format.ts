const TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  etf: "ETF",
  fund: "Fund",
  index: "Index",
  crypto: "Crypto",
  currency: "Currency",
  other: "Other",
};

export const typeLabel = (type: string) => TYPE_LABELS[type] ?? type;

/** A price with sensible decimals: more for small numbers such as currency rates. */
export function formatPrice(value: number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const digits = abs >= 10 ? 2 : abs >= 0.01 ? 4 : 6;
  const text = value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency && /^[A-Z]{3}$/.test(currency) ? `${text} ${currency}` : text;
}

export function formatChange(change: number, percent: number): { text: string; direction: "up" | "down" | "flat" } {
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const abs = Math.abs(change);
  const digits = abs >= 1 || abs === 0 ? 2 : 4;
  return {
    text: `${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} (${sign}${Math.abs(percent).toFixed(2)}%)`,
    direction,
  };
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

/** "Oct 30, 4:00 PM" in the viewer's time zone, with the zone name. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
