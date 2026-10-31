import { useEffect, useRef, useState, type FormEvent } from "react";
import type { WatchList } from "../../shared/lists";
import { formatChange, formatPrice, formatTime, typeLabel } from "../format";
import { useLists } from "../lists";
import { Link, navigate, quotePath } from "../router";
import { useQuotes } from "../useQuotes";

function NameForm({ initial, label, onSave, onCancel }: { initial: string; label: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };
  return (
    <form className="name-form" onSubmit={submit}>
      <input ref={input} aria-label={label} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onCancel()} />
      <button className="button button-small" type="submit">
        Save
      </button>
      <button className="button button-small button-quiet" type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function ListTable({ list }: { list: WatchList }) {
  const { removeItem } = useLists();
  const { quotes, pending, unavailable } = useQuotes(list.items.map((i) => i.symbol));

  if (list.items.length === 0) {
    return <p className="empty">This list is empty. Search for a stock, ETF, currency or crypto above and add it with ☆ Add to list.</p>;
  }
  return (
    <table className="list-table">
      <thead>
        <tr>
          <th scope="col">Symbol</th>
          <th scope="col" className="num">
            Price
          </th>
          <th scope="col" className="num hide-narrow">
            Today
          </th>
          <th scope="col" className="num hide-narrow">
            As of
          </th>
          <th scope="col">
            <span className="visually-hidden">Remove</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {list.items.map((item) => {
          const q = quotes[item.symbol];
          const change = q ? formatChange(q.data.change, q.data.changePercent) : null;
          return (
            <tr key={item.symbol} onClick={() => navigate(quotePath(item.symbol))}>
              <td>
                <Link href={quotePath(item.symbol)} className="row-symbol" onClick={(e) => e.stopPropagation()}>
                  {item.symbol}
                </Link>
                <div className="row-name">
                  {item.name} <span className="muted">· {item.type === "stock" ? item.exchange : typeLabel(item.type)}</span>
                </div>
              </td>
              <td className="num">
                {q ? formatPrice(q.data.price) : unavailable.has(item.symbol) ? <span className="muted">No data</span> : pending.has(item.symbol) ? <span className="muted" title="Waiting for the free data plan's limit">…</span> : "–"}
                {q?.stale && <span className="stale" title="An older price: it refreshes when the data plan allows"> •</span>}
                {change && <div className={`chip ${change.direction} show-narrow`}>{change.text}</div>}
              </td>
              <td className="num hide-narrow">{change && <span className={`chip ${change.direction}`}>{change.text}</span>}</td>
              <td className="num muted small hide-narrow">{q ? formatTime(q.data.asOf) : ""}</td>
              <td className="actions">
                <button
                  className="icon-button"
                  aria-label={`Remove ${item.symbol} from ${list.name}`}
                  title="Remove from this list"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(list.id, item.symbol).catch(() => {});
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ListsPage({ selected }: { selected: string | null }) {
  const { lists, error, create, rename, remove } = useLists();
  const [mode, setMode] = useState<"view" | "new" | "rename">("view");

  if (error) return <p className="error">Your lists could not be loaded. Reload the page to try again.</p>;
  if (!lists) return <p className="muted">Loading your lists…</p>;

  const current = lists.find((l) => l.id === selected) ?? lists[0];
  const select = (id: string) => navigate(`/?list=${id}`, true);

  return (
    <section>
      <div className="tabs" role="tablist" aria-label="Your lists">
        {lists.map((l) => (
          <button key={l.id} role="tab" aria-selected={l.id === current?.id} className={l.id === current?.id ? "tab active" : "tab"} onClick={() => (setMode("view"), select(l.id))}>
            {l.name}
            <span className="tab-count">{l.items.length}</span>
          </button>
        ))}
        <button className="tab tab-new" onClick={() => setMode("new")}>
          + New list
        </button>
      </div>

      {mode === "new" && (
        <NameForm
          initial=""
          label="New list name"
          onCancel={() => setMode("view")}
          onSave={async (name) => {
            const l = await create(name);
            setMode("view");
            select(l.id);
          }}
        />
      )}

      {!current && mode !== "new" && (
        <div className="empty">
          <p>You have no lists.</p>
          <button className="button" onClick={() => setMode("new")}>
            Make a list
          </button>
        </div>
      )}

      {current && (
        <>
          {mode === "rename" ? (
            <NameForm
              initial={current.name}
              label="List name"
              onCancel={() => setMode("view")}
              onSave={(name) => {
                rename(current.id, name).catch(() => {});
                setMode("view");
              }}
            />
          ) : (
            <div className="list-head">
              <h1 className="page-title">{current.name}</h1>
              <div className="list-actions">
                <button className="button button-small button-quiet" onClick={() => setMode("rename")}>
                  Rename
                </button>
                <button
                  className="button button-small button-quiet"
                  onClick={() => {
                    const n = current.items.length;
                    if (window.confirm(`Delete the list “${current.name}”${n ? ` and its ${n} ticker${n === 1 ? "" : "s"}` : ""}?`)) {
                      remove(current.id).catch(() => {});
                      navigate("/", true);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
          <ListTable list={current} />
        </>
      )}
    </section>
  );
}
