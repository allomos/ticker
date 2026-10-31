// The signed-in user's lists, shared by the home page and the add-to-list buttons.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ListItem, WatchList } from "../shared/lists";
import type { InstrumentType } from "../shared/market";
import { api } from "./api";
import { useAuth } from "./auth";

export interface NewItem {
  symbol: string;
  name: string;
  exchange: string;
  type: InstrumentType;
}

interface Lists {
  /** undefined while loading or signed out. */
  lists: WatchList[] | undefined;
  error: boolean;
  reload: () => Promise<void>;
  create: (name: string) => Promise<WatchList>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addItem: (id: string, item: NewItem) => Promise<void>;
  removeItem: (id: string, symbol: string) => Promise<void>;
}

const ListsContext = createContext<Lists | null>(null);

export function ListsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lists, setLists] = useState<WatchList[] | undefined>(undefined);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLists(await api.lists());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (user) reload();
    else setLists(undefined);
  }, [user, reload]);

  // Changes show at once; when the server refuses one, the lists are loaded again.
  const change = useCallback(
    async (local: (ls: WatchList[]) => WatchList[], remote: () => Promise<unknown>) => {
      setLists((ls) => (ls ? local(ls) : ls));
      try {
        await remote();
      } catch (e) {
        await reload();
        throw e;
      }
    },
    [reload],
  );

  const value = useMemo<Lists>(
    () => ({
      lists,
      error,
      reload,
      create: async (name) => {
        const list = await api.createList(name);
        setLists((ls) => [...(ls ?? []), list]);
        return list;
      },
      rename: (id, name) => change((ls) => ls.map((l) => (l.id === id ? { ...l, name } : l)), () => api.renameList(id, name)),
      remove: (id) => change((ls) => ls.filter((l) => l.id !== id), () => api.deleteList(id)),
      addItem: (id, item) => {
        const added: ListItem = { ...item, addedAt: new Date().toISOString() };
        return change(
          (ls) => ls.map((l) => (l.id === id && !l.items.some((i) => i.symbol === item.symbol) ? { ...l, items: [...l.items, added] } : l)),
          () => api.addItem(id, item),
        );
      },
      removeItem: (id, symbol) =>
        change((ls) => ls.map((l) => (l.id === id ? { ...l, items: l.items.filter((i) => i.symbol !== symbol) } : l)), () => api.removeItem(id, symbol)),
    }),
    [lists, error, reload, change],
  );
  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists(): Lists {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists outside ListsProvider");
  return ctx;
}
