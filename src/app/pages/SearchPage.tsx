import { AddToList } from "../components/AddToList";
import { ResultRow, useSearch } from "../components/SearchBox";
import { Link, quotePath } from "../router";

export function SearchPage({ query }: { query: string }) {
  const { results, loading, error } = useSearch(query, 0);
  const available = results.filter((r) => r.available);
  const others = results.filter((r) => !r.available);
  return (
    <section>
      <h1 className="page-title">Results for “{query}”</h1>
      {loading && results.length === 0 && <p className="muted">Searching…</p>}
      {error && <p className="error">Search is not answering. Try again in a moment.</p>}
      {!loading && !error && results.length === 0 && <p className="muted">No matches. Try a company name or a ticker such as AAPL.</p>}
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
          <h2 className="section-title">Not on the free data plan</h2>
          <p className="muted small">These listings exist, but the app's free price data does not cover them, so they cannot be opened or added to a list.</p>
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
