import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SearchResult } from "../../shared/market";
import { api } from "../api";
import { typeLabel } from "../format";
import { navigate, quotePath } from "../router";

export function useSearch(query: string, delay = 250) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .search(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setError(false);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(true);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, delay]);
  return { results, loading, error };
}

export function ResultRow({ r }: { r: SearchResult }) {
  return (
    <>
      <span className="result-symbol">{r.symbol}</span>
      <span className="result-name">{r.name}</span>
      <span className="result-meta">
        {r.exchange}
        {r.country && r.type !== "crypto" && r.type !== "currency" ? ` · ${r.country}` : ""}
      </span>
      <span className="badge">{typeLabel(r.type)}</span>
      {!r.available && <span className="badge badge-muted" title="This symbol is not covered by the app's free data plan">Not on free data</span>}
    </>
  );
}

export function SearchBox({ initial = "" }: { initial?: string }) {
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { results, loading } = useSearch(query);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  // Covered symbols first; at most three uncovered listings, so they do not crowd the list.
  const covered = results.filter((r) => r.available).slice(0, 8);
  const shown = [...covered, ...results.filter((r) => !r.available).slice(0, Math.min(3, 8 - covered.length))];

  useEffect(() => setActive(-1), [results]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (r: SearchResult) => {
    if (!r.available) return;
    setOpen(false);
    setQuery("");
    navigate(quotePath(r.symbol));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && shown[active]) choose(shown[active]);
      else if (query.trim()) {
        setOpen(false);
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <div className="search" ref={box}>
      <input
        type="search"
        className="search-input"
        placeholder="Search stocks, ETFs, crypto, currencies"
        aria-label="Search by name or ticker"
        role="combobox"
        aria-expanded={open && query.trim() !== ""}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {open && query.trim() !== "" && (
        <ul className="search-results" role="listbox" id={listId}>
          {loading && shown.length === 0 && <li className="search-note">Searching…</li>}
          {!loading && shown.length === 0 && <li className="search-note">No matches</li>}
          {shown.map((r, i) => (
            <li
              key={`${r.symbol}|${r.exchange}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={!r.available}
              className={`result${i === active ? " active" : ""}${r.available ? "" : " unavailable"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
            >
              <ResultRow r={r} />
            </li>
          ))}
          {results.length > 0 && (
            <li className="search-note">
              <a
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
              >
                All results for “{query.trim()}”
              </a>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
