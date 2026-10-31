**Outcome.** A user reads Ticker in English, Simplified Chinese, Traditional Chinese or Japanese: every screen, message and the sign-in email are in the chosen language, and the user can switch languages at any time.

**Done means.**
- Every on-screen text (search, ticker details, lists, sign-in, errors, empty states) and the sign-in email (`src/worker/auth/mailer.ts`) has an English, Simplified Chinese, Traditional Chinese and Japanese version; no screen shows mixed languages.
- On a first visit the app follows the browser's language (zh-CN/zh-SG/zh-Hans → Simplified, zh-TW/zh-HK/zh-MO/zh-Hant → Traditional, ja → Japanese), otherwise English.
- A language switcher is on every page; the choice is kept in this browser only and survives reloads.
- The sign-in email is in the language the user had when they asked for the link.
- Numbers, prices, percentages, dates and times follow the chosen language's format.
- The page's `lang` attribute (`en`, `zh-Hans`, `zh-Hant`, `ja`) and title follow the chosen language.
- Tests cover the browser-language detection, the switch and the fallback; the app is checked in the browser in all four languages at desktop and phone width, locally and at ticker.allomos.com.

**Notes.** Approved to start: the approver made it ready on 2026-10-31.

Decided by the approver (2026-10-31):
1. Chinese in both Simplified and Traditional.
2. First visit follows the browser's language, falling back to English.
3. The choice is kept in this browser only (no database change).
4. Company and exchange names from Twelve Data stay as they come (English).
5. Whether the URL carries the language: left to the agent; decided not to (see AI decisions).
