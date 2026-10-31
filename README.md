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
