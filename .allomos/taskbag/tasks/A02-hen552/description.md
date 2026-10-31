**Outcome.** `/api/search`, `/api/quote` and `/api/chart` return clean data from Twelve Data; results are cached and shared between users, and the app never sends more than the free plan allows (8 a minute, 800 a day).

**Done means.**
- Tests with a fake Twelve Data cover search, quote, chart ranges, caching and the request budget.
- Against the real service with the local key, `curl` returns AAPL's quote and a 1M chart.

**Notes.** Part of goal A01-teapot655. The key is the Worker secret `TWELVE_DATA_API_KEY` (locally in `.dev.vars`).
