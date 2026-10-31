**Outcome.** A signed-in user who hits a limit — a stock the free Twelve Data plan does not cover (Tokyo, Shanghai, Shenzhen and other exchanges), or the shared request budget running out ("busy") — is offered to add their own API key: a paid Twelve Data key, or their own iTick key. From then on the app fetches their data with their key, within that key's limits, and they see those stocks.

**Done means.**
- Where a user meets a limit (search result marked not available, details page, a list row, "busy"), the app explains why and offers to add a key.
- In their account, a user adds, sees (masked, last 4 characters only) and removes a Twelve Data and/or an iTick key; the app tests a key when it is added and says whether it works.
- With a key saved, that user's requests use it: their Twelve Data key for what it covers, their iTick key for JP, SH and SZ stocks. Without one they get today's behaviour.
- Each saved key has its own request budget, so one user's key is never pushed past its limits and never slows other users.
- Data fetched with a user's own key is served only to that user, never to anyone else from the shared cache.
- Keys are stored encrypted with a Worker secret, never logged, never sent to the browser after saving, and removed when the user removes them or their account.
- Tests cover adding and removing keys, routing by key, per-key budgets, cache separation and the "not available" / "busy" prompts.

**Notes.**
- Idea from the approver on 2026-10-31. Builds on A02-bath658 (iTick client and owner-only rule): block on it.
- Open for the approver, before this task is made ready:
  1. **Storing other people's keys** is sensitive data: keep them encrypted in D1 (works on every device), or only in the user's browser (nothing stored on the server, but must be added again on each device).
  2. **Twelve Data plan limits** differ by paid plan: ask the user for their plan's limits, or read them from Twelve Data's usage endpoint.
  3. **Wording and placement** of the "add your own key" prompt, in all four languages.
