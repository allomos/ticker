**Outcome.** A ticker's details page shows a breadcrumb trail above the ticker name, for example `Home > Tech stocks`. Clicking **Home** goes back to the home page; clicking the list name goes back to that list on the home page (`/?list=<id>`).

**Done means.**
- Opening a ticker from a list (for example `Tech stocks`) shows `Home > Tech stocks` on its page.
- Clicking `Home` opens `/`; clicking `Tech stocks` opens `/?list=<that list's id>` with that list selected.
- Reloading the details page, or using the browser's back and forward buttons, keeps the right trail.
- Tests pass; checked locally (`npm run dev`) and on ticker.allomos.com after deploy.

**Notes.**
- Code: `src/app/pages/QuotePage.tsx` (details page), `src/app/pages/ListsPage.tsx` (home page, list chosen with `?list=<id>`), `src/app/router.tsx`. The quote path (`/quote/AAPL`) does not carry the list today, so the list the user came from has to be passed along, for example as `/quote/AAPL?list=<id>`.
- Open for the approver (what users see):
  1. What does the trail show when the ticker was opened from search, from a shared link, or by a signed-out user, so there is no list? Suggested: `Home > Search: "<query>"` from search, just `Home` otherwise.
  2. Should the list name come from the list the user came from only, or also from a list the ticker is in when no list was passed? Suggested: only the list the user came from.
- Waiting for the approver's go-ahead before any work starts (asked 2026-10-31).
