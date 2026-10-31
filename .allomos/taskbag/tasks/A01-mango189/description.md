**Outcome.** Release v0.1 is tried against the spec's criteria 1, 6, 7, 9 and 10, and steps are written for the person.

**Done means.**
- Automated tests and `curl` checks against the local app pass.
- Steps for the person to try it are written.

**Notes.** Part of goal A01-teapot655.


## Evidence

2026-10-31, on master after merging A01-mascot452, A02-hen552, A03-film078 and A03-statue382, local dev server with the real Twelve Data key:

```
## npm test
 Test Files  6 passed (6)
      Tests  35 passed (35)
## typecheck
ok
## build
✓ built in 18ms
✓ built in 267ms
## search apple (criterion 1, 9)
AAPL NASDAQ True | uncovered listed: 28
## search AAPL / bitcoin / yen
AAPL -> AAPL stock
bitcoin -> BTC/USD crypto
yen -> USD/JPY currency
## quote AAPL (criterion 6, 7)
344.63 -4.28 -1.22668 asOf 2026-10-30T19:59:00.000Z 52w 243.42 351.73001 stale False
## chart AAPL 1D and 5Y
1D 5min 78 points
5Y 1week 262 points
## uncovered symbol (criterion 9)
quote 7203 -> HTTP 404
## pages
/ -> 200
/search?q=apple -> 200
/quote/AAPL -> 200
## budget (criterion 10)
[{'slot': 'd:2026-10-31', 'used': 6}, {'slot': 'm:2026-10-31T10:16', 'used': 6}]
```

Per-request credits checked against the local budget table: a new quote 1, a new chart range 1, a cached quote 0.
