**Outcome.** Every ticker's details page includes a search button. Clicking it opens Google in the browser to search for the latest financial news about that stock.

**Done means.**
- A ticker's details page shows a search button for the stock's latest financial news.
- Clicking the button opens Google in the browser searching for the latest financial news about that stock.
- Button text and accessible label are localized across all supported languages (English, Simplified Chinese, Traditional Chinese, Japanese).
- Tests pass; checked locally (`npm run dev`).

**Notes.**
- Code: `src/app/pages/QuotePage.tsx` (ticker details header, alongside `AddToList`), `src/app/i18n/` (localized strings).
- Routine choices for the implementer (record with `alm ai-decided`): exact button placement and icon/label, Google search URL parameters (e.g. News tab `tbm=nws` or query terms combining symbol and name), and opening in a new tab (`target="_blank" rel="noopener noreferrer"`).
