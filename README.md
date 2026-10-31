# Ticker

A stock watchlist web app: search stocks, ETFs, currencies and crypto, keep several private
lists, and open a ticker for its price, chart and key figures. It runs on Cloudflare Workers
with a D1 database, at https://ticker.allomos.com.

## Develop

```bash
npm install
npm run dev        # app and API at http://localhost:5173
npm test           # Worker tests (in the Workers runtime) and app tests
npm run typecheck
npm run build
```

Before the first `npm run dev`, create the local database:

```bash
npx wrangler d1 migrations apply ticker --local
```

Local secrets live in `.dev.vars` (never committed):

```
TWELVE_DATA_API_KEY=...   # free key from twelvedata.com
RESEND_API_KEY=...        # Resend key for sign-in emails
```

## Layout

- `src/worker/`: the Cloudflare Worker (Hono): `/api/*` and `/auth/*`.
- `src/app/`: the React web app, served as static assets.
- `migrations/`: D1 database migrations.
- `test/worker/`, `test/app/`: tests.

## Sign-in

Users sign in with a link sent by email (`POST /auth/email`), valid once for 15 minutes. The
link opens `/signin/verify`, whose button posts the token (`POST /auth/verify`), so mail
scanners that open links do not use it up. Sessions last 30 days and are kept in D1 as hashes.
On localhost no email is sent: the link is written to the dev server's log. Elsewhere it goes
through Resend, from `MAIL_FROM`.

## Lists

A new account starts with one list, "Watchlist". All `/api/lists` routes need a signed-in user
and touch only that user's lists; another user's list answers 404.

- `GET /api/lists`, `POST /api/lists {name}`, `PATCH /api/lists/:id {name}`, `DELETE /api/lists/:id`
- `POST /api/lists/order {ids}`
- `POST /api/lists/:id/items {symbol, name, exchange, type}`, `DELETE /api/lists/:id/items/:symbol`

## Market data

Prices come from Twelve Data's free plan: 8 requests a minute, 800 a day, one request per
symbol. The Worker (`src/worker/market/`) caches everything in D1 and shares it between users,
and reserves credits in the `api_budget` table before each request (7 a minute, 780 a day). When
the budget is spent it answers with the latest cached data, marked `stale`, or `503 busy` with
`Retry-After` when it has none. Search needs no key and uses no credits.

- `GET /api/search?q=apple`
- `GET /api/quote?symbol=AAPL`
- `GET /api/quotes?symbols=AAPL,MSFT,BTC/USD` (some may come back as `pending`)
- `GET /api/chart?symbol=AAPL&range=1M` (`1D 5D 1M 6M YTD 1Y 5Y MAX`)
