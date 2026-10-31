import { AddToList } from "../components/AddToList";
import { ResultRow, useSearch } from "../components/SearchBox";
import { useI18n } from "../i18n";
import { Link, quotePath } from "../router";

export function SearchPage({ query }: { query: string }) {
  const { t } = useI18n();
  const { results, loading, error } = useSearch(query, 0);
  const available = results.filter((r) => r.available);
  const others = results.filter((r) => !r.available);
  return (
    <section>
      <h1 className="page-title">{t.resultsFor(query)}</h1>
      {loading && results.length === 0 && <p className="muted">{t.searching}</p>}
      {error && <p className="error">{t.searchError}</p>}
      {!loading && !error && results.length === 0 && <p className="muted">{t.noMatchesHint}</p>}
      {available.length > 0 && (
        <ul className="result-list">
          {available.map((r) => (
            <li key={`${r.symbol}|${r.exchange}`} className="result">
              <Link href={quotePath(r.symbol)} className="result-link">
                <ResultRow r={r} />
              </Link>
              <span className="result-add">
                <AddToList target={r} compact />
              </span>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <>
          <h2 className="section-title">{t.notOnPlanTitle}</h2>
          <p className="muted small">{t.notOnPlanText}</p>
          <ul className="result-list">
            {others.map((r) => (
              <li key={`${r.symbol}|${r.exchange}`} className="result unavailable">
                <ResultRow r={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
