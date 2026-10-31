**Outcome.** The sign-in email carries a long sign-in code next to the link. A user who asked to sign in from the home-screen web app (where the email's link would open in Safari instead) copies the code and pastes it into Ticker to sign in. The link keeps working as today.

**Done means.**
- The sign-in email shows the code, for example `K7QM-4XRP-9TWD-2HNC`: 16 characters from an alphabet without look-alikes (no 0/O, 1/I/L), grouped by four for reading, about 80 bits of randomness, stored only as a hash in D1.
- The code follows the link's rules: works once, for 15 minutes, and using either the code or the link uses up both.
- Typing it is forgiving: lower case, spaces, missing or extra dashes are accepted.
- Guessing is stopped: at most 5 wrong codes per sign-in request, after which that request is void and the user asks for a new email; the existing per-address and per-network limits still apply.
- Copying is one tap:
  - The email's link opens a Ticker page in the browser that signs that browser in **and** shows the code with a **Copy** button, saying "Signing in on your home-screen app? Copy this code and paste it there."
  - The email itself shows the code in a large box that selects as one piece on long-press (emails cannot run a copy button).
  - The sign-in screen in Ticker, after "Send link", shows a code field with a **Paste** button.
- Tests cover the code's format, hashing, expiry, single use, shared use with the link, the wrong-code limit and the forgiving input; texts in every language the app has (`src/app/i18n/messages.tsx`).
- Locally, the code appears in the dev server's log beside the link.

**Notes.**
- Asked by the approver (2026-10-31): a long code to reduce the risk of a breach, with a copy button to help the user copy it. An email cannot run a working copy button, so the copy button lives on the page the link opens, with a paste button in the app.
- Needed by A01-kite192 (home-screen web app): on iPhone, the home-screen web app and Safari are signed in separately.
- Changes the sign-in built in A04-goblet948 (`src/worker/auth/`, `src/app/auth.tsx`).
- Deploying to ticker.allomos.com is an outside effect: it waits for the approver's go-ahead.
