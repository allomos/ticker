-- Each user's lists and the symbols in them. A list belongs to one user only.
CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX lists_user ON lists (user_id, position);

CREATE TABLE list_items (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  exchange TEXT NOT NULL,
  type TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (list_id, symbol)
);
