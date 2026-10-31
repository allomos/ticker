# Project notes

What every session must know, whatever its task. Keep it short, and change lines in place.

## Running

Nothing.

## Pitfalls

- npm 10 fails with "Cannot read properties of null (reading 'edgesOut')" on some installs; the
  project's `.npmrc` sets `legacy-peer-deps=true`, which avoids it. Keep it.
- Each checkout (and each task worktree) has its own local D1 database: run
  `npx wrangler d1 migrations apply ticker --local` before `npm run dev`.
- Twelve Data's free plan allows 8 requests a minute and 800 a day for the whole app (local dev
  and production share the same key). Tests never call it: they use a fake (test/worker/fake-twelvedata.ts)
  and the key `test-key`. Avoid scripts that loop over the real API.
- `@cloudflare/vitest-pool-workers` is deprecated; the project uses `@cloudflare/vitest-plugin`.

## Repositories

Where the code and this taskbag are kept online, one list item each, so an agent working from a
copy elsewhere (in the cloud, say) can find both: `- Code: https://github.com/<owner>/<repo>`.
The address only: never a token or a personal detail. None yet.

## Where credentials live

Never their values, and no personal details (email addresses, account names): write a
placeholder such as `<ACCOUNT_EMAIL>` and how to look it up.

- Local: `.dev.vars` in the project folder (never committed): `TWELVE_DATA_API_KEY` (free key,
  twelvedata.com dashboard of `<TWELVE_DATA_ACCOUNT_EMAIL>`) and `RESEND_API_KEY` (resend.com,
  API Keys, domain `ticker.allomos.com`). Task worktrees link to it.
- Cloudflare: Wrangler's OAuth login on this Mac (`npx wrangler whoami`).

## Agents set up

AI agents whose rule files follow AGENTS.md (`alm guide agent-files`): agent, its file, date.
- Claude Code: CLAUDE.md (imports AGENTS.md), 2026-10-31
