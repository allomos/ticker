import { useEffect, useRef, useState, type FormEvent } from "react";
import type { WatchList } from "../../shared/lists";
import { formatChange, formatPrice, formatTime } from "../format";
import { useI18n } from "../i18n";
import { useLists } from "../lists";
import { Link, navigate, quotePath } from "../router";
import { useQuotes } from "../useQuotes";

function NameForm({ initial, label, onSave, onCancel }: { initial: string; label: string; onSave: (name: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
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
        {t.save}
      </button>
      <button className="button button-small button-quiet" type="button" onClick={onCancel}>
        {t.cancel}
      </button>
    </form>
  );
}

function ListTable({ list }: { list: WatchList }) {
  const { removeItem } = useLists();
  const { t, locale } = useI18n();
  const { quotes, pending, unavailable } = useQuotes(list.items.map((i) => i.symbol));

  if (list.items.length === 0) {
    return <p className="empty">{t.emptyList}</p>;
  }
  return (
    <table className="list-table">
      <thead>
        <tr>
          <th scope="col">{t.colSymbol}</th>
          <th scope="col" className="num">
            {t.colPrice}
          </th>
          <th scope="col" className="num hide-narrow">
            {t.colToday}
          </th>
          <th scope="col" className="num hide-narrow">
            {t.colAsOf}
          </th>
          <th scope="col">
            <span className="visually-hidden">{t.colRemove}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {list.items.map((item) => {
          const q = quotes[item.symbol];
          const change = q ? formatChange(q.data.change, q.data.changePercent, locale) : null;
          return (
            <tr key={item.symbol} onClick={() => navigate(quotePath(item.symbol, { list: list.id }))}>
              <td>
                <Link href={quotePath(item.symbol, { list: list.id })} className="row-symbol" onClick={(e) => e.stopPropagation()}>
                  {item.symbol}
                </Link>
                <div className="row-name">
                  {item.name} <span className="muted">· {item.type === "stock" ? item.exchange : (t.types[item.type] ?? item.type)}</span>
                </div>
              </td>
              <td className="num">
                {q ? formatPrice(q.data.price, locale) : unavailable.has(item.symbol) ? <span className="muted">{t.noData}</span> : pending.has(item.symbol) ? <span className="muted" title={t.waitingTitle}>…</span> : "–"}
                {q?.stale && <span className="stale" title={t.staleTitle}> •</span>}
                {change && <div className={`chip ${change.direction} show-narrow`}>{change.text}</div>}
              </td>
              <td className="num hide-narrow">{change && <span className={`chip ${change.direction}`}>{change.text}</span>}</td>
              <td className="num muted small hide-narrow">{q ? formatTime(q.data.asOf, locale) : ""}</td>
              <td className="actions">
                <button
                  className="icon-button"
                  aria-label={t.removeFrom(item.symbol, list.name)}
                  title={t.removeTitle}
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
  const { t } = useI18n();
  const [mode, setMode] = useState<"view" | "new" | "rename">("view");

  if (error) return <p className="error">{t.listsError}</p>;
  if (!lists) return <p className="muted">{t.listsLoading}</p>;

  const current = lists.find((l) => l.id === selected) ?? lists[0];
  const select = (id: string) => navigate(`/?list=${id}`, true);

  return (
    <section>
      <div className="tabs" role="tablist" aria-label={t.listsLabel}>
        {lists.map((l) => (
          <button key={l.id} role="tab" aria-selected={l.id === current?.id} className={l.id === current?.id ? "tab active" : "tab"} onClick={() => (setMode("view"), select(l.id))}>
            {l.name}
            <span className="tab-count">{l.items.length}</span>
          </button>
        ))}
        <button className="tab tab-new" onClick={() => setMode("new")}>
          {t.newList}
        </button>
      </div>

      {mode === "new" && (
        <NameForm
          initial=""
          label={t.newListName}
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
          <p>{t.noLists}</p>
          <button className="button" onClick={() => setMode("new")}>
            {t.makeList}
          </button>
        </div>
      )}

      {current && (
        <>
          {mode === "rename" ? (
            <NameForm
              initial={current.name}
              label={t.listName}
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
                  {t.rename}
                </button>
                <button
                  className="button button-small button-quiet"
                  onClick={() => {
                    if (window.confirm(t.confirmDelete(current.name, current.items.length))) {
                      remove(current.id).catch(() => {});
                      navigate("/", true);
                    }
                  }}
                >
                  {t.delete}
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
