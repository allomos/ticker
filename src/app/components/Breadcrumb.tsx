import { useI18n } from "../i18n";
import { useLists } from "../lists";
import { Link } from "../router";

/**
 * Home, then the list or search a ticker's page was opened from. Only that list is named, never
 * another list holding the ticker; an unknown list (deleted, or signed out) leaves just Home.
 */
export function Breadcrumb({ list, query }: { list: string | null; query: string | null }) {
  const { t } = useI18n();
  const { lists } = useLists();
  const from = list ? lists?.find((l) => l.id === list) : undefined;
  const crumb = from
    ? { href: `/?list=${encodeURIComponent(from.id)}`, label: from.name }
    : !list && query
      ? { href: `/search?q=${encodeURIComponent(query)}`, label: t.searchCrumb(query) }
      : null;
  return (
    <nav className="breadcrumb" aria-label={t.breadcrumb}>
      <ol>
        <li>
          <Link href="/">{t.home}</Link>
        </li>
        {crumb && (
          <li>
            <Link href={crumb.href}>{crumb.label}</Link>
          </li>
        )}
      </ol>
    </nav>
  );
}
