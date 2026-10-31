**Outcome.** The app's owner, signed in, can search, open and add China A-share (Shanghai, Shenzhen) stocks, and Tokyo (TSE) stocks if Alpha Vantage covers them — for example 600519 Kweichow Moutai or 7203 Toyota — and sees their price, day change and daily chart. Twelve Data's free plan does not cover these exchanges, so Alpha Vantage answers them, while Twelve Data keeps serving everything it covers. Alpha Vantage's free key is for personal, non-commercial use, so nobody else gets this data: other users and visitors see these stocks as not available, as today.

**Done means.**
- A first check with the real key answers the plan's open points:
  - `GLOBAL_QUOTE` and `TIME_SERIES_DAILY` for `600519.SHH` and a Shenzhen stock.
  - Whether Tokyo is covered at all (for example `7203` on Tokyo), and that Twelve Data's search returns Moutai and Toyota with `XSHG` and `XTKS`.
  - What Alpha Vantage answers when the daily limit is reached.
  - If Tokyo is not covered, go back to the approver before building the Japan part (choices: Marketstack, which asks for a home address at sign-up, or J-Quants Light, ¥1,650 a month); China goes ahead.
- Search stays on Twelve Data (approver, 2026-10-31), which already finds these stocks by code and by name, with their exchange (`mic_code`): for the owner, results on `XSHG`, `XSHE` (and `XTKS` if covered) are no longer marked as not on the free plan, and open with Alpha Vantage's symbol (`600519.SHH`, `000002.SHZ`). No Alpha Vantage request is spent on search.
- The quote and chart pages and the list prices work for them, through the same cache.
- Charts for these stocks (approver, 2026-10-31): only daily prices for the last 100 trading days are free, so the 1D, 1Y, 5Y and MAX ranges are greyed out, and 5D, 1M, 6M and YTD show the daily prices there are.
- Requests are not counted ahead of time (approver, 2026-10-31): when Alpha Vantage answers that the daily limit is reached, the app pauses it until the next day and the owner sees "busy"; cached data is still shown.
- Prices are end-of-day on the free key, so each stock's data is fetched at most once after its market closes and served from the cache until then; the page says the price is from the last close.
- The owner is the account whose address equals the Worker secret `MARKET_OWNER_EMAIL` (locally in `.dev.vars`); the address is never written in the code, the repository or the taskbag.
- Alpha Vantage is called, and its cached data served, only for the owner's session: anonymous visitors and other accounts get "not available" for these stocks, even when the data is in the cache.
- Tests with a fake Alpha Vantage cover routing by exchange, quote, chart, caching, the pause after a limit error, and the owner-only rule (owner, other account, signed out).

**Notes.**
- **Source: Alpha Vantage**, chosen by the approver on 2026-10-31 (iTick given up). Marketstack was considered as a backup and dropped for now (approver, 2026-10-31): its sign-up asks for a home address, its free plan is 100 requests a month, and its Asian coverage is unverified. It comes back only if Tokyo needs it.
- What Alpha Vantage's pages say (read on 2026-10-31):
  - Free key: "25 API requests per day".
  - Examples: Shanghai `600104.SHH`, Shenzhen `000002.SHZ`; no Tokyo example in the docs read.
  - `GLOBAL_QUOTE` is "updated at the end of each trading day"; `TIME_SERIES_DAILY` `compact` (last 100 days) is free, while `full`, intraday and adjusted are premium.
  - Terms: "personal, non-commercial use"; giving other people access counts as commercial.
- Key: Worker secret `ALPHA_VANTAGE_API_KEY` (locally in `.dev.vars`).
- Set up by the approver on 2026-10-31: `ALPHA_VANTAGE_API_KEY` and `MARKET_OWNER_EMAIL` are in `.dev.vars`; both still have to be set as Worker secrets before production (an outside effect: ask the approver).
- Market data lives in `src/worker/market/` (Twelve Data client, D1 cache, `api_budget`).
- The iTick account made on 2026-10-31 is no longer needed (its free key expires 2026-11-07).

## Evidence

- 2026-10-31, claude-code-29ed5bb1: Probe with the real Alpha Vantage key, 2026-11-01 ~00:40 JST, about 11 of the day's 25 requests: GLOBAL_QUOTE 600519.SHH (1392.05, 2026-10-30) and 000002.SHZ (3.19) answer; TIME_SERIES_DAILY compact gives 100 days; 7203.T answers an empty quote and SYMBOL_SEARCH finds no Tokyo listing. Requests closer than 1 s apart get an 'Information' note (1 request per second). Local owner check: 3 more requests (quote, chart; list served from cache)
