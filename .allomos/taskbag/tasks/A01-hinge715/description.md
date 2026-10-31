**Outcome.** A visitor who isn't signed in sees a polished front page that shows what Ticker does and invites them to sign in; the sign-in and "check your email" screens match it.

**Done means.**
- The signed-out home page (today a heading, one paragraph and a "Sign in" button in `src/app/App.tsx`) gets a designed hero with the logo, a short pitch, a preview of what a list and a ticker page look like, and a clear sign-in button.
- `/signin` and `/signin/verify` (`src/app/pages/SignInPage.tsx`) share the same look.
- A mock-up shown to the approver before it is built; built as approved.
- Looks right at desktop and phone width, in light and dark; tests and build pass; deployed to ticker.allomos.com after the approver's go.

**Notes.**
- Open for the approver: the page's look and wording (what users will see), and the go to deploy (outside effect). Not to be started before the approver says go.
- Uses the logo from A01-grotto889; do that one first.
- If A01-pearl420 (Chinese, Japanese, English) lands first, the new wording goes through it.
