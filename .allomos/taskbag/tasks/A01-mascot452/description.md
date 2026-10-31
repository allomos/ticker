**Outcome.** `npm run dev` serves the React web app and a `/api/health` endpoint from one Cloudflare Worker on this Mac; `npm test` and `npm run build` pass.

**Done means.**
- `npm test` passes (Worker tests in the Workers runtime).
- `npm run build` succeeds.
- `curl localhost:8787/api/health` answers `{"ok":true}` and `/` serves the app.

**Notes.** Part of goal A01-teapot655. Stack: Cloudflare Worker (TypeScript, Hono) with static assets, React + Vite, D1.
