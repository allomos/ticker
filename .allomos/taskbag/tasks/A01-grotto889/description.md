**Outcome.** Ticker has a logo of its own: people see it in the browser tab, in the app's header and on the sign-in email, and it reads clearly at small and large sizes, in light and dark.

**Done means.**
- Two or three logo directions shown to the approver as images (mark and wordmark, at 16 px, 32 px and header size, on light and dark); the approver picks one.
- The chosen logo is in the project as SVG (mark, mark + wordmark) and replaces `public/favicon.svg` (today a blue square with a line chart) and the header's text-only "Ticker".
- The sign-in email shows the logo (or its name in the logo's colours, if the email can't load images reliably).
- Checked in the browser at desktop and phone width; tests and build pass.

**Notes.**
- Open for the approver: which logo direction (what users will see and get used to). Not to be started before the approver says go.
- Feeds the landing-page task (the page before sign-in uses this logo).
