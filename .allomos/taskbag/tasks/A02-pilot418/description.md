**Outcome.** Tokyo (TSE) stocks, for example 7203 Toyota, behave for every user, the owner included, like a stock off the free data plan: they show in search and on a stock's page with the "add your own key" prompt (A02-jungle045). A user who adds their own Twelve Data key on a plan that covers Tokyo sees their price, day change and chart.

**Decision (approver, 2026-11-02).** No data source for Tokyo on the app's keys: treat Tokyo stocks as hitting the limit for every user. Marketstack and J-Quants Light are not used.

**Done means.**
- Searching "7203" or "Toyota" lists the Tokyo listing, marked not on the free plan, for every user, the owner included; opening it shows the add-a-key prompt, not an empty page or an error.
- For Tokyo stocks the prompt names only Twelve Data (Alpha Vantage does not cover Tokyo), in all four languages; other stocks keep the current wording.
- With a user's own Twelve Data key that covers Tokyo, the stock opens with quote, chart and list price, cached per user (as A02-jungle045). If the plain symbol is ambiguous, the request names the exchange (XTKS).
- With a user's own key that does not cover Tokyo, they see that their key's plan does not cover it, not a crash.
- No new request is spent on the app's shared keys for Tokyo stocks.
- Tests with a fake source; checked locally.

**Notes.**
- Split from A02-bath658 on 2026-10-31: Alpha Vantage does not cover Tokyo (GLOBAL_QUOTE for `7203.T` answers an empty quote; SYMBOL_SEARCH finds no Tokyo listing).
- Check first: an earlier look found no XTKS row in Twelve Data's search for "7203" or "Toyota Motor". If search with `show_plan` still returns none, Tokyo stocks need another way into search (for example, a known `7203.T`-style code typed in), and that is a question for the approver.
- Today's code: search marks non-free rows `available: false` (src/worker/market/twelvedata.ts); the prompt is src/app/components/AddKeyPrompt.tsx; wording in src/app/i18n/messages.tsx (`promptNotOnPlanText`).
- China (Shanghai, Shenzhen) is done in A02-bath658.
