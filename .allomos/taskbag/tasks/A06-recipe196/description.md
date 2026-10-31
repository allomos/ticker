**Outcome.** In production, asking for a sign-in link sends a real email through Resend from `no-reply@ticker.allomos.com`.

**Done means.**
- A test send to Resend's test address `delivered@resend.dev` succeeds through the deployed app's email code.
- The person signs in with their own address (their check).

**Notes.** Part of goal A01-teapot655. The person added `ticker.allomos.com` to Resend; its DNS records are in Cloudflare.
