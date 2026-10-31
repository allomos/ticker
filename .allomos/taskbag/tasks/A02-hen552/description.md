**Outcome.** `/api/search`, `/api/quote` and `/api/chart` return clean data from Twelve Data; results are cached and shared between users, and the app never sends more than the free plan allows (8 a minute, 800 a day).

**Done means.**
- Tests with a fake Twelve Data cover search, quote, chart ranges, caching and the request budget.
- Against the real service with the local key, `curl` returns AAPL's quote and a 1M chart.

**Notes.** Part of goal A01-teapot655. The key is the Worker secret `TWELVE_DATA_API_KEY` (locally in `.dev.vars`).

**Reopened 2026-10-31 (approver): react to the limit instead of counting.**
- The shared Twelve Data key no longer counts requests ahead of time (the `api_budget` of 7 a minute and 780 a day goes).
- When Twelve Data answers that the limit is reached (code 429, per minute or per day), the app pauses Twelve Data until the next minute, or the next day for the daily limit, and users see "busy"; cached data is still shown.
- Done means for the change: tests with the fake Twelve Data cover the pause after a 429 (minute and day) and that cached data is still served; the old budget tests are replaced.
- Known trade-off, explained to the approver: one busy page or local test can use up the day's 800 for everyone, since local dev and production share the key.
