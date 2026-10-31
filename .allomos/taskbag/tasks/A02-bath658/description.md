**Outcome.** A user can search, open and add Tokyo (TSE) and China A-share (Shanghai, Shenzhen) stocks, for example 7203 Toyota or 600519 Kweichow Moutai, and sees their price, day change and chart. Twelve Data's free plan does not cover these exchanges, so a second free data source answers them, while Twelve Data keeps serving everything it covers.

**Done means.**
- Search finds Japanese and Chinese stocks by code and by name, and they are no longer marked as not on the free plan.
- The quote and chart pages and the list prices work for them, served from the second source through the same cache.
- The second source has its own request budget, like Twelve Data's, and the app never exceeds that source's free limits.
- Tests with a fake second source cover routing by exchange, quote, chart, caching and its budget.
- Checked against the real service with a local key: one Tokyo and one Shanghai stock.

**Notes.** Open for the approver, before this task is made ready:
1. **Which source.** Candidates found on 2026-10-31, none verified with a real key yet:
   - iTick (itick.org): free plan that claims SSE, SZSE and TSE quotes; about 5 REST requests a minute (third-party summary). Most likely fit; check that its free plan really includes these markets and charts, and its terms for a public site.
   - Alpha Vantage: lists Shanghai, Shenzhen and Tokyo, but the free tier is only 25 requests a day, for non-commercial use.
   - EODHD (20 a day) and Finnhub (international on paid plans) are unlikely to fit on their free plans.
   - Unofficial no-key endpoints (Yahoo Finance, Tencent/Sina quotes) work but have no terms of use for this, can be blocked from Cloudflare, and can break without notice.
2. **A new account and key** for the chosen source (a new Worker secret, locally in `.dev.vars`).
3. **Delayed or end-of-day data** on a free plan: acceptable, and how to show it to users.

Market data lives in `src/worker/market/` (Twelve Data client, D1 cache, `api_budget`).
