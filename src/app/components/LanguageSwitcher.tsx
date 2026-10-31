import { LOCALES, LOCALE_NAMES, isLocale } from "../../shared/locale";
import { useI18n } from "../i18n";

/** Shown at the foot of every page; each language is named in that language. */
export function LanguageSwitcher() {
  const { locale, t, setLocale } = useI18n();
  return (
    <label className="language">
      <span className="language-icon" aria-hidden="true">
        文A
      </span>
      <select aria-label={t.language} value={locale} onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
