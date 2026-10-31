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
