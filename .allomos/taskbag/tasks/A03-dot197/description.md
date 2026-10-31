**Outcome.** A ticker's details page shows a breadcrumb trail above the ticker name, for example `Home > Tech stocks`. Clicking **Home** goes back to the home page; clicking the list name goes back to that list on the home page (`/?list=<id>`).

**Done means.**
- Opening a ticker from a list (for example `Tech stocks`) shows `Home > Tech stocks` on its page.
- Opening a ticker from search for "apple" shows `Home > Search: "apple"`; clicking it opens `/search?q=apple`. Opened by a direct link, it shows just `Home`.
- Clicking `Home` opens `/`; clicking `Tech stocks` opens `/?list=<that list's id>` with that list selected.
- Reloading the details page, or using the browser's back and forward buttons, keeps the right trail.
- Tests pass; checked locally (`npm run dev`) and on ticker.allomos.com after deploy.

**Notes.**
- Code: `src/app/pages/QuotePage.tsx` (details page), `src/app/pages/ListsPage.tsx` (home page, list chosen with `?list=<id>`), `src/app/router.tsx`. The quote path (`/quote/AAPL`) does not carry the list today, so the list the user came from has to be passed along, for example as `/quote/AAPL?list=<id>`.
- Decided by the approver (2026-10-31):
  1. Opened from search: the trail shows `Home > Search: "<query>"`, and clicking it goes back to those search results. With no list and no search (a shared link, or a signed-out user), it shows just `Home`.
  2. The list name is only ever the list the user came from, never a list the ticker happens to be in.

## Evidence

- 2026-10-31, claude-code-29ed5bb1: Deployed to ticker.allomos.com 2026-10-31 ~23:35 JST from master 0890629 by another session (Worker version 016408b1; remote D1 migrations through 0004)
