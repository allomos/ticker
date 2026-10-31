-- Shared market data cache and the Twelve Data request budget.
CREATE TABLE market_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- One row per budget window: "m:<UTC minute>" and "d:<UTC day>".
CREATE TABLE api_budget (
  slot TEXT PRIMARY KEY,
  used INTEGER NOT NULL
);
