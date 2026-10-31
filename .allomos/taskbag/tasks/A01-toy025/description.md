**Outcome.** Release v0.3 is tried against every criterion of the spec on the live site, and steps are written for the person.

**Done means.**
- `curl` checks against https://ticker.allomos.com pass.
- Steps for the person to try the live app are written.

**Notes.** Part of goal A01-teapot655.


## Evidence

2026-10-31, live site https://ticker.allomos.com (Worker version 3dd8ddaf), checked with curl. Signed-in parts used two temporary accounts written directly into the production D1 database (users smoke-a/smoke-b@example.invalid with one-hour sessions), removed afterwards; nothing left behind. The first account's session was not created on the first try (a one-off when creating it), so its steps were run again.

```
## 11: live site
  https page 200
{"ok":true}  health 
## 1, 9: search
  apple -> AAPL NASDAQ stock | not covered, marked: 28
  AAPL -> AAPL NASDAQ stock | not covered, marked: 19
  bitcoin -> BTC/USD Crypto crypto | not covered, marked: 13
  yen -> USD/JPY Currency currency | not covered, marked: 9
  vanguard -> VOO NYSE etf | not covered, marked: 16
## 6, 7: details
  MSFT 521.90997 -8.23004 -1.55243 open 525.27002 prev 530.14001 52w 349.20001 551.15002 vol 35618300 asOf 2026-10-30T19:59:00.000Z
  chart 1D 78 points
  chart 1Y 253 points
  Toyota 7203 (not covered) -> 404
## 8: sign-in required
  lists signed out -> 401
## 8: two temporary accounts signed in
{"user":{"email":"smoke-a@example.invalid"}}
{"user":{"email":"smoke-b@example.invalid"}}
## 4: several lists, rename, delete
{"ok":true}{"ok":true}
  Watchlist []
  Big Tech []
## 2, 3: add three, remove one
{"ok":true}{"ok":true}{"ok":true}{"ok":true}
{"ok":true}
  Watchlist ['AAPL', 'ETH/USD']
  Big Tech ['NVDA']
## 8: privacy
  Watchlist []
  B renames A's list -> 404
  B adds to A's list -> 404
  B deletes A's list -> 404
  Watchlist ['AAPL', 'ETH/USD']
  Big Tech ['NVDA']
## clean-up: remove the two temporary accounts
  {'users': 0, 'orphan_sessions': 0, 'orphan_lists': 0, 'orphan_items': 0}
  A's session now: {"user":null}
```

Also: a sign-in email through Resend to delivered@resend.dev was accepted (A06-recipe196); the ticker page renders live in the browser.
