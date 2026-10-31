**Outcome.** Ticker has a logo of its own: people see it in the browser tab, in the app's header and on the sign-in email, and it reads clearly at small and large sizes, in light and dark.

**Done means.**
- Two or three logo directions shown to the approver as images (mark and wordmark, at 16 px, 32 px and header size, on light and dark); the approver picks one.
- The chosen logo is in the project as SVG (mark, mark + wordmark) and replaces `public/favicon.svg` (today a blue square with a line chart) and the header's text-only "Ticker".
- The sign-in email shows the logo (or its name in the logo's colours, if the email can't load images reliably).
- Checked in the browser at desktop and phone width; tests and build pass.

**Notes.**
- Colour style (approver, 2026-10-31): the logo and the website follow www.allomos.com. Its palette: light background #fbfcfe, surface #ffffff, text navy #12223a, muted #55667c, lines #e2e7ee, link #1f7a6f; dark background #0e1726, surface #152136, text #e8edf4, muted #9aa8bb, lines #26344c, link #5cc8ba; accents teal #2a9d8f (main, buttons), coral #e76f51, gold #e9c46a. Its logo is made of outlined and filled circles plus a gold four-point star, with no background tile.
- Drafts shown in the conversation on 2026-10-31 in the Allomos colours: A tick and rise, B rising dots (teal ring, teal dot, coral dot, gold star), C ring and candle. The approver picks one.
- Approver, 2026-10-31: go with B, plus a circle or ball in its upper-left corner. Versions shown: B1 coral ring (echoes Allomos's outlined and filled coral), B2 gold ball, B3 small teal ball; the approver picks one.
- Approver, 2026-10-31: swap them: the gold star goes to the upper-left corner and the new circle to the lower-right corner (where the star was). Versions shown with the swap: B1 coral ring, B2 gold ball, B3 teal ball; the approver picks one.
- **Chosen (approver, 2026-10-31): B2.** Rising dots with the gold star upper left and a gold ball lower right. Drawn on a 32×32 grid, no background tile:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Ticker">
<path d="M9.6 21.6L13 19M19.3 13.2L21.6 11.4" stroke="#2a9d8f" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="6.5" cy="24" r="3.6" fill="none" stroke="#2a9d8f" stroke-width="2.6"/>
<circle cx="16" cy="16.5" r="4.2" fill="#2a9d8f"/>
<circle cx="25" cy="8" r="5.2" fill="#e76f51"/>
<path d="M7 3.5l1.2 2.8 2.8 1.2-2.8 1.2L7 11.5 5.8 8.7 3 7.5l2.8-1.2z" fill="#e9c46a"/>
<circle cx="25.5" cy="24.5" r="4" fill="#e9c46a"/>
</svg>
```
- Logo direction chosen (B2, below). Approver made the task ready on 2026-10-31: work may start.
- Feeds the landing-page task (the page before sign-in uses this logo).
