import type { InstrumentType } from "./market";

export interface ListItem {
  symbol: string;
  name: string;
  exchange: string;
  type: InstrumentType;
  addedAt: string;
}

export interface WatchList {
  id: string;
  name: string;
  items: ListItem[];
}

export const LIMITS = { lists: 50, items: 200, name: 60 };
