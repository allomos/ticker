**Outcome.** Anyone enters their email address and gets a sign-in link (valid 15 minutes, used once); opening it signs them in, and they can sign out. Accounts and sessions are kept in D1.

**Done means.**
- Tests cover the link's expiry and single use, sessions, sign-out and request limits per email address.
- Locally, the link appears in the dev server's log; in production it is sent through Resend.

**Notes.** Part of goal A01-teapot655. Sender: `no-reply@ticker.allomos.com`. The Resend key is the Worker secret `RESEND_API_KEY`.
