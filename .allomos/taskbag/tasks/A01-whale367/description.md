**Outcome.** Release v0.2 is tried against the spec's criteria 2, 3, 4, 5 and 8, and steps are written for the person.

**Done means.**
- Automated tests and `curl` checks against the local app pass, with two users.
- Steps for the person to try it are written.

**Notes.** Part of goal A01-teapot655.


## Evidence

2026-10-31, on master after merging A04-goblet948, A05-bird102, A05-guide010 and A05-cable879, local dev server, two users signed in with local sign-in links:

```
## npm test
 Test Files  11 passed (11)
      Tests  66 passed (66)
## typecheck
ok
## build
✓ built in 287ms
## two users signed in (carol, dave)
{"user":{"email":"carol.check@example.com"}}
{"user":{"email":"dave.check@example.com"}}
## criterion 4: several lists, rename, delete
  Watchlist []
  Tech []
  Temp []
  rename Tech -> Big Tech, delete Temp:
{"ok":true}{"ok":true}
  Watchlist []
  Big Tech []
## criterion 2: add tickers
{"ok":true}{"ok":true}{"ok":true}{"ok":true}
  Watchlist ['AAPL', 'MSFT', 'BTC/USD']
  Big Tech ['NVDA']
## criterion 3: remove MSFT
{"ok":true}
  Watchlist ['AAPL', 'BTC/USD']
  Big Tech ['NVDA']
## privacy: dave sees only his own list, and cannot change carol's
  Watchlist []
  dave renames carol's list -> 404
  dave adds to carol's list -> 404
  dave deletes carol's list -> 404
  signed out -> 401
  Watchlist ['AAPL', 'BTC/USD']
  Big Tech ['NVDA']
## criterion 5: prices for carol's Watchlist
  AAPL 344.63 -4.28 -1.22668 2026-10-30T19:59:00.000Z
  BTC/USD 77522.78 154.01 0.19905965 2026-10-31T10:29:00.000Z
  pending []
## criterion 8: carol's lists after the server restarts
  Watchlist ['AAPL', 'BTC/USD']
  Big Tech ['NVDA']
```
