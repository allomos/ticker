**Outcome.** A visitor who isn't signed in sees a polished front page that shows what Ticker does and invites them to sign in; the sign-in and "check your email" screens match it.

**Done means.**
- The signed-out home page (today a heading, one paragraph and a "Sign in" button in `src/app/App.tsx`) gets a designed hero with the logo, a short pitch, a preview of what a list and a ticker page look like, and a clear sign-in button.
- `/signin` and `/signin/verify` (`src/app/pages/SignInPage.tsx`) share the same look.
- A mock-up shown to the approver before it is built; built as approved.
- Looks right at desktop and phone width, in light and dark; tests and build pass; deployed to ticker.allomos.com after the approver's go.

**Notes.**
- Colour style (approver, 2026-10-31): the logo and the website follow www.allomos.com. Its palette: light background #fbfcfe, surface #ffffff, text navy #12223a, muted #55667c, lines #e2e7ee, link #1f7a6f; dark background #0e1726, surface #152136, text #e8edf4, muted #9aa8bb, lines #26344c, link #5cc8ba; accents teal #2a9d8f (main, buttons), coral #e76f51, gold #e9c46a. Its logo is made of outlined and filled circles plus a gold four-point star, with no background tile.
- Mock-up shown in the conversation on 2026-10-31 (Allomos colours, logo B). Approver, 2026-10-31: price rises and falls stay green and red (today's --up #137333 / --down #c5221f, dark #81c995 / #f28b82), not teal and coral; the signed-in screens move to the Allomos palette too, in their own task, A01-sofa728.
- Approver made the task ready on 2026-10-31, after seeing the mock-up: build it as in the mock-up, with logo B2 and green/red for rises and falls. Still open for the approver: the go to deploy (outside effect).
- Uses the logo B2 from A01-grotto889; do that one first.
- If A01-pearl420 (Chinese, Japanese, English) lands first, the new wording goes through it.

## Evidence

- 2026-10-31, claude-code-29ed5bb1: Deployed to ticker.allomos.com 2026-11-01 ~00:05 JST from master ec2fb5d by claude-code-29ed5bb1 after the approver said 'Yes, deploy' in this session; Worker version 69ae9d14-c449-409b-8750-42653524d8cb; no migration
