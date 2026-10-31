import { useEffect, useRef, useState, type FormEvent } from "react";
import type { InstrumentType } from "../../shared/market";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { useLists, type NewItem } from "../lists";
import { Link } from "../router";

export interface AddTarget {
  symbol: string;
  name: string;
  exchange: string;
  /** Unknown on a ticker's page: looked up with search (no credits) when first added. */
  type?: InstrumentType;
}

async function resolveType(target: AddTarget): Promise<NewItem> {
  if (target.type) return { ...target, type: target.type };
  try {
    const results = await api.search(target.symbol);
    const match = results.find((r) => r.available && r.symbol === target.symbol);
    if (match) return { symbol: target.symbol, name: target.name, exchange: match.exchange, type: match.type };
  } catch {
    // Fall through to a guess.
  }
  return { ...target, type: target.symbol.includes("/") ? "crypto" : "stock" };
}

/** A button that shows the user's lists with a tick on each list holding the symbol. */
export function AddToList({ target, compact = false }: { target: AddTarget; compact?: boolean }) {
  const { user } = useAuth();
  const { lists, addItem, removeItem, create } = useLists();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState(false);
  /** Ticks shown at once, before the change is saved. */
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const box = useRef<HTMLDivElement>(null);
  const item = useRef<Promise<NewItem> | null>(null);
  // Looks up the type as soon as the menu opens, so ticking a list does not wait for it.
  const resolved = () => (item.current ??= resolveType(target));
  useEffect(() => {
    if (open) resolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!user) {
    if (user === undefined) return null;
    return (
      <Link className={`button button-small button-quiet${compact ? " compact" : ""}`} href="/signin" onClick={(e) => e.stopPropagation()}>
        {compact ? "☆" : t.signInToAdd}
      </Link>
    );
  }

  const holding = (lists ?? []).filter((l) => l.items.some((i) => i.symbol === target.symbol));
  const toggle = async (listId: string, inList: boolean) => {
    setError(false);
    setTicks((t) => ({ ...t, [listId]: !inList }));
    try {
      if (inList) await removeItem(listId, target.symbol);
      else await addItem(listId, await resolved());
    } catch {
      setError(true);
    } finally {
      setTicks(({ [listId]: _, ...rest }) => rest);
    }
  };
  const createAndAdd = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const list = await create(name);
      await addItem(list.id, await resolved());
      setNaming(false);
      setNewName("");
    } catch {
      setError(true);
    }
  };

  const label = holding.length ? (compact ? "★" : holding.length === 1 ? t.inList(holding[0].name) : t.inLists(holding.length)) : compact ? "☆" : t.addToList;
  return (
    <div className="add-to-list" ref={box} onClick={(e) => e.stopPropagation()}>
      <button
        className={`button button-small ${holding.length ? "button-on" : "button-quiet"}${compact ? " compact" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={compact ? t.addSymbolToAList(target.symbol) : undefined}
        title={compact ? (holding.length ? t.inListsTitle(holding.map((l) => l.name).join(", ")) : t.addToAList) : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="menu add-menu" role="group" aria-label={t.listsFor(target.symbol)}>
          <div className="menu-note">{t.addSymbolTo(target.symbol)}</div>
          {(lists ?? []).map((l) => {
            const inList = ticks[l.id] ?? l.items.some((i) => i.symbol === target.symbol);
            return (
              <label key={l.id} className="menu-item check">
                <input type="checkbox" checked={inList} onChange={() => toggle(l.id, inList)} />
                <span>{l.name}</span>
              </label>
            );
          })}
          {naming ? (
            <form className="menu-form" onSubmit={createAndAdd}>
              <input autoFocus aria-label={t.newListName} maxLength={60} placeholder={t.listName} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <button className="button button-small" type="submit">
                {t.add}
              </button>
            </form>
          ) : (
            <button className="menu-item new" onClick={() => setNaming(true)}>
              {t.newList}
            </button>
          )}
          {error && <div className="menu-note error">{t.didNotWork}</div>}
        </div>
      )}
    </div>
  );
}
