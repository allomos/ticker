// The language the app is shown in: the browser's own on a first visit, then the one the user
// picks, kept in this browser only (localStorage).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectLocale, isLocale, type Locale } from "../../shared/locale";
import { MESSAGES, type Messages } from "./messages";

export const STORAGE_KEY = "ticker.lang";

function stored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

export function initialLocale(): Locale {
  return stored() ?? detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]);
}

interface I18n {
  locale: Locale;
  t: Messages;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18n>({ locale: "en", t: MESSAGES.en, setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((l: Locale) => {
    setState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Private windows may refuse storage: the choice then lasts until the page closes.
    }
  }, []);
  const t = MESSAGES[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t.title;
  }, [locale, t]);
  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
