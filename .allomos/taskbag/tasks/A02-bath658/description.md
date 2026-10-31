**Outcome.** A user can search, open and add Tokyo (TSE) and China A-share (Shanghai, Shenzhen) stocks, for example 7203 Toyota or 600519 Kweichow Moutai, and sees their price, day change and chart. Twelve Data's free plan does not cover these exchanges, so iTick answers them, while Twelve Data keeps serving everything it covers.

**Done means.**
- A first check with the real iTick key answers the plan's open points: a quote and a daily chart for 7203 (`region=JP`) and 600519 (`region=SH`), real-time or delayed, and how far back the history goes. If iTick fails it, stop and go back to the approver before building anything.
- Search finds Japanese and Chinese stocks by code and by name, and they are no longer marked as not on the free plan.
- The quote and chart pages and the list prices work for them, served from iTick through the same cache.
- iTick has its own request budget, like Twelve Data's (free plan: 5 REST calls a minute), and the app never goes over it.
- Tests with a fake iTick cover routing by exchange, quote, chart, caching and its budget.

**Notes.**
- **Source: iTick**, chosen by the approver on 2026-10-31 ("i want to try iTick").
- What iTick's pages say (read on 2026-10-31):
  - Free plan: "Time Limited Free", "for personal use only", 5 REST calls a minute, "End of Day Data" and "Historical Data".
  - Equities named: "HK stocks, U.S. stocks, and in-demand A-share products". The free plan does not state whether it covers Japan, whether it is real-time or delayed, any daily cap, or how deep the history goes.
- API: base `https://api.itick.org`, token in the `token` request header.
  - `GET /symbol/list?type=stock&region=…&code=…`: no keyword search is documented.
  - `GET /stock/quote?region=&code=`: fields `ld` price, `ch`/`chp` change, `p` previous close.
  - `GET /stock/kline?region=&code=&kType=&limit=`: `kType` 8 is one day.
  - Region codes: `JP`, `SH`, `SZ`.
- Open for the approver, before this task is made ready:
  1. **Public site vs "personal use only".** ticker.allomos.com is public. Ask iTick whether that is allowed on the free plan, or limit iTick to local use until it is.
  2. **Account and key.** The approver signs up at https://itick.org/en ("Get Now", Google or GitHub), copies the API key from https://itick.org/en/dashboard into `.dev.vars` as `ITICK_API_KEY`, and later sets it as a Worker secret.
  3. **Delayed or end-of-day prices**: acceptable, and how to show them to users.
  4. **Search by name**: iTick documents no keyword search, so finding stocks by name may need a built-in list or Twelve Data's search.
- Market data lives in `src/worker/market/` (Twelve Data client, D1 cache, `api_budget`).
