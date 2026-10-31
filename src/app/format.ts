import { INTL_TAG, type Locale } from "../shared/locale";

/** A price with sensible decimals: more for small numbers such as currency rates. */
export function formatPrice(value: number | null | undefined, locale: Locale, currency?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const digits = abs >= 10 ? 2 : abs >= 0.01 ? 4 : 6;
  const text = value.toLocaleString(INTL_TAG[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency && /^[A-Z]{3}$/.test(currency) ? `${text} ${currency}` : text;
}

export function formatChange(change: number, percent: number, locale: Locale): { text: string; direction: "up" | "down" | "flat" } {
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const abs = Math.abs(change);
  const digits = abs >= 1 || abs === 0 ? 2 : 4;
  const tag = INTL_TAG[locale];
  const pct = new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(percent) / 100);
  return {
    text: `${sign}${abs.toLocaleString(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits })} (${sign}${pct})`,
    direction,
  };
}

export function formatCompact(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat(INTL_TAG[locale], { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

/** "Oct 30, 4:00 PM" in the viewer's time zone, with the zone name, written the language's way. */
export function formatTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(INTL_TAG[locale], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
