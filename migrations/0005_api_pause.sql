-- The app no longer counts Twelve Data requests ahead of time (api_budget goes). Instead, when
-- Twelve Data answers that its limit is reached, every Worker instance pauses it until `until`
-- (milliseconds since 1970): the next minute, or the next UTC day for the daily limit.
DROP TABLE api_budget;
CREATE TABLE api_pause (
  source TEXT PRIMARY KEY,
  until INTEGER NOT NULL,
  reason TEXT NOT NULL
);
