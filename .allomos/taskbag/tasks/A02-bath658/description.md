**Outcome.** The app's owner, signed in, can search, open and add Tokyo (TSE) and China A-share (Shanghai, Shenzhen) stocks, for example 7203 Toyota or 600519 Kweichow Moutai, and sees their price, day change and daily chart. Twelve Data's free plan does not cover these exchanges, so Alpha Vantage answers them, with Marketstack as the backup, while Twelve Data keeps serving everything it covers. Both free plans are for personal, non-commercial use, so nobody else gets this data: other users and visitors see these stocks as not available, as today.

**Done means.**
- A first check with the real keys answers the plan's open points:
  - Alpha Vantage: `GLOBAL_QUOTE` and `TIME_SERIES_DAILY` for `600519.SHH`, `SYMBOL_SEARCH` for "toyota" and "moutai", and whether Tokyo is covered at all.
  - Marketstack: end-of-day prices for Toyota on Tokyo (`XTKS`) and Moutai on Shanghai (`XSHG`), and how its symbols are written.
  - What each answers when its limit is reached.
  - If Japan is covered by neither, stop and go back to the approver before building anything.
- Search finds Japanese and Chinese stocks by code and by name, and they are no longer marked as not on the free plan.
- The quote and chart pages and the list prices work for them, through the same cache: Alpha Vantage first; Marketstack when Alpha Vantage does not cover the stock or has hit its limit.
- Requests are not counted ahead of time (approver, 2026-10-31): when a source answers that its limit is reached, the app pauses that source until it resets (Alpha Vantage: the next day; Marketstack: the next month) and tries the other; with both paused the owner sees "busy", and cached data is still shown.
- Prices are end-of-day on both free plans, so each stock's data is fetched at most once after its market closes and served from the cache until then; the page says the price is from the last close.
- The owner is the account whose address equals the Worker secret `MARKET_OWNER_EMAIL` (locally in `.dev.vars`); the address is never written in the code, the repository or the taskbag.
- These sources are called, and their cached data served, only for the owner's session: anonymous visitors and other accounts get "not available" for these stocks, even when the data is in the cache.
- Tests with fake Alpha Vantage and Marketstack cover routing by exchange, the fall-back to Marketstack, quote, chart, caching, the pause after a limit error, and the owner-only rule (owner, other account, signed out).

**Notes.**
- **Sources**: Alpha Vantage, with Marketstack as the backup, chosen by the approver on 2026-10-31 (iTick given up).
- What their pages say (read on 2026-10-31):
  - **Alpha Vantage**:
    - Free key: "25 API requests per day".
    - Examples: Shanghai `600104.SHH`, Shenzhen `000002.SHZ`; no Tokyo example in the docs read.
    - `GLOBAL_QUOTE` is "updated at the end of each trading day"; `TIME_SERIES_DAILY` `compact` (last 100 days) is free, while `full`, intraday and adjusted are premium.
    - Terms: "personal, non-commercial use"; giving other people access counts as commercial.
  - **Marketstack**:
    - Free plan: "100 Requests / mo", "End-of-Day Data", "1 Year History", "Non-Commercial Use".
    - Its docs did not render, so Tokyo/Shanghai/Shenzhen coverage, symbol format and search are unverified.
- Keys: Worker secrets `ALPHA_VANTAGE_API_KEY` and `MARKETSTACK_API_KEY` (locally in `.dev.vars`).
- Open for the approver, before this task is made ready:
  1. **Account and keys.** The approver signs up for both (alphavantage.co/support/#api-key and marketstack.com/signup/free), puts the keys and `MARKET_OWNER_EMAIL` (the address they sign in with) into `.dev.vars`, and later sets them as Worker secrets.
  2. **Charts.** Only daily prices are free: at most 100 days from Alpha Vantage, 1 year from Marketstack. For these stocks the 1D and 1W ranges cannot show intraday prices: hide them, or show daily points.
  3. **Search by name** costs a request each time from a budget of 25 a day: search these stocks only by code, or keep a small built-in list of names.
- Market data lives in `src/worker/market/` (Twelve Data client, D1 cache, `api_budget`).
- The iTick account made on 2026-10-31 is no longer needed (its free key expires 2026-11-07).
