# Project notes

What every session must know, whatever its task. Keep it short, and change lines in place.

## Running

- Production: https://ticker.allomos.com, Cloudflare Worker `ticker` (custom domain; workers.dev
  off), D1 database `ticker` (id in wrangler.jsonc), daily cron `17 3 * * *` (clean-up).
  Deployed 2026-10-31 ~23:35 JST from master as of 0890629 (four languages, breadcrumb, sign-in
  code, logo), Worker version 016408b1; remote D1 migrations applied through 0004. Deploy: `npm run build && npx wrangler deploy`; migrations:
  `npx wrangler d1 migrations apply ticker --remote`.
- Nothing runs locally between sessions (`npm run dev` is started per check).
- Local sign-in: the dev server logs `[sign-in for <address>] code <code> link <link>`; open the
  link, or type the code on the sign-in screen.

## Pitfalls

- npm 10 fails with "Cannot read properties of null (reading 'edgesOut')" on some installs; the
  project's `.npmrc` sets `legacy-peer-deps=true`, which avoids it. Keep it.
- Each checkout (and each task worktree) has its own local D1 database: run
  `npx wrangler d1 migrations apply ticker --local` before `npm run dev`.
- Twelve Data's free plan allows 8 requests a minute and 800 a day for the whole app (local dev
  and production share the same key). Tests never call it: they use a fake (test/worker/fake-twelvedata.ts)
  and the key `test-key`. Avoid scripts that loop over the real API. Production and local dev
  keep separate budgets in their own D1, but share the one key: heavy local use can make
  production answer "busy" for a minute.
- `@cloudflare/vitest-pool-workers` is deprecated; the project uses `@cloudflare/vitest-plugin`.

## Repositories

Where the code and this taskbag are kept online, one list item each, so an agent working from a
copy elsewhere (in the cloud, say) can find both: `- Code: https://github.com/<owner>/<repo>`.
The address only: never a token or a personal detail.

- Code: https://github.com/allomos/ticker (public, MIT licence, branch `master`; created 2026-10-31,
  public since 2026-10-31). Everything committed is public: secrets stay in `.dev.vars` only.
- Taskbag: in the same repository, `.allomos/taskbag/`
- Pushing: this Mac's default SSH key for `github.com` belongs to another GitHub account, which
  cannot reach `allomos`. The `origin` remote uses an SSH host alias from `~/.ssh/config` that
  points to the account with access. Keep it, and use it in new clones too.

## Where credentials live

Never their values, and no personal details (email addresses, account names): write a
placeholder such as `<ACCOUNT_EMAIL>` and how to look it up.

- Local: `.dev.vars` in the project folder (never committed): `TWELVE_DATA_API_KEY` (free key,
  twelvedata.com dashboard of `<TWELVE_DATA_ACCOUNT_EMAIL>`) and `RESEND_API_KEY` (resend.com,
  API Keys, domain `ticker.allomos.com`). Task worktrees link to it.
- Cloudflare: Wrangler's OAuth login on this Mac (`npx wrangler whoami`), account of
  `<CLOUDFLARE_ACCOUNT_EMAIL>`; zone `allomos.com`.
- Production secrets on the Worker `ticker`: `TWELVE_DATA_API_KEY`, `RESEND_API_KEY`
  (`npx wrangler secret list`); set from `.dev.vars` with `wrangler deploy --secrets-file .dev.vars`.

## Agents set up

AI agents whose rule files follow AGENTS.md (`alm guide agent-files`): agent, its file, date.
- Claude Code: CLAUDE.md (imports AGENTS.md), 2026-10-31
