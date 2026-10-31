**Outcome.** A user reads Ticker in Chinese, Japanese or English: every screen, message and the sign-in email are in the chosen language, and the user can switch languages at any time.

**Done means.**
- Every on-screen text (search, ticker details, lists, sign-in, errors, empty states) and the sign-in email (`src/worker/auth/mailer.ts`) has a Chinese, Japanese and English version; no screen shows mixed languages.
- A language switcher is on every page; the choice is kept across reloads (and for a signed-in user, across devices if decided so below).
- Numbers, prices, percentages, dates and times follow the chosen language's format.
- The page's `lang` attribute and title follow the chosen language.
- Tests cover the switch and the fallback; the app is checked in the browser in all three languages at desktop and phone width, locally and at ticker.allomos.com.

**Notes.** Waiting for the approver's go-ahead before any work starts (asked 2026-10-31). Open for the approver to decide:
1. Chinese: Simplified only, or also Traditional?
2. First visit: follow the browser's language (falling back to English), or always start in one language?
3. Where the choice is kept: in this browser only, or also on the signed-in account (needs a new column in the D1 database)?
4. Company names and exchange names come from Twelve Data in English; keep them as they are (proposed), since the data source does not translate them.
5. Should the URL carry the language (for example `/ja/...`), or not (proposed: not)?
