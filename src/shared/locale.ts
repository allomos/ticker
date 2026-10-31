// The languages Ticker is written in, shared by the web app and the Worker (sign-in email,
// first list's name).
export const LOCALES = ["en", "zh-Hans", "zh-Hant", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** The tag given to Intl for numbers, dates and times in each language. */
export const INTL_TAG: Record<Locale, string> = { en: "en-US", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", ja: "ja-JP" };

/** Each language's name, written in that language, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文", ja: "日本語" };

function match(tag: string): Locale | null {
  const t = tag.toLowerCase();
  if (t === "ja" || t.startsWith("ja-")) return "ja";
  if (t === "en" || t.startsWith("en-")) return "en";
  if (t === "zh" || t.startsWith("zh-")) {
    if (/-hant\b/.test(t)) return "zh-Hant";
    if (/-hans\b/.test(t)) return "zh-Hans";
    return /-(tw|hk|mo)\b/.test(t) ? "zh-Hant" : "zh-Hans";
  }
  return null;
}

/** The first of the browser's languages that Ticker has, or else English. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const found = match(tag);
    if (found) return found;
  }
  return "en";
}

/** The name of a new account's first list. */
export const DEFAULT_LIST_NAME: Record<Locale, string> = { en: "Watchlist", "zh-Hans": "自选股", "zh-Hant": "自選股", ja: "ウォッチリスト" };
