**Outcome.** A signed-in user who hits a limit — a stock the free Twelve Data plan does not cover (Tokyo, Shanghai, Shenzhen and other exchanges), or the shared request budget running out ("busy") — is offered to add their own API key: a paid Twelve Data key, or their own iTick key. From then on the app fetches their data with their key, within that key's limits, and they see those stocks.

**Done means.**
- Where a user meets a limit (search result marked not available, details page, a list row, "busy"), the app explains why and offers to add a key.
- In their account, a user adds, sees (masked, last 4 characters only) and removes a Twelve Data and/or an iTick key; the app tests a key when it is added and says whether it works.
- When adding a key, the user is asked where to keep it, with a plain explanation of each, and the app supports both:
  - **On the server, encrypted**: works on every device they sign in on. Stored in D1 encrypted with AES-256-GCM (Web Crypto), a fresh random 12-byte nonce per key, the user's id bound in as additional data, and a master-key version for later rotation; the master key is the Worker secret `KEY_ENCRYPTION_KEY` (32 random bytes; locally in `.dev.vars`). Decrypted only in memory for the call to Twelve Data or iTick, never sent back to the browser.
  - **Only in this browser**: never stored on the server. Kept in the browser's storage and sent with each request over HTTPS; the server uses it for that request only, never stores or logs it. Must be added again on each device, and is lost when the browser's site data is cleared.
- A user can see where each key is kept and move it from one to the other.
- With a key saved, that user's requests use it: their Twelve Data key for what it covers, their iTick key for JP, SH and SZ stocks. Without one they get today's behaviour.
- Each saved key has its own request budget, so one user's key is never pushed past its limits and never slows other users.
- Data fetched with a user's own key is served only to that user, never to anyone else from the shared cache.
- Keys are never logged; server-kept keys are removed when the user removes them or their account.
- Tests cover adding and removing keys in both places, encryption round-trip and the user-id binding, routing by key, per-key budgets, cache separation and the "not available" / "busy" prompts.

**Notes.**
- Idea from the approver on 2026-10-31. Builds on A02-bath658 (iTick client and owner-only rule): block on it.
- Decided by the approver on 2026-10-31: the user chooses where each key is kept, on the server encrypted or only in their browser; the app supports both.
- Open for the approver, before this task is made ready:
  1. **Twelve Data plan limits** differ by paid plan: ask the user for their plan's limits, or read them from Twelve Data's usage endpoint.
  2. **Wording and placement** of the "add your own key" prompt, in all four languages.
