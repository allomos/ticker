**Outcome.** On a phone, a user adds Ticker to the home screen (iPhone Safari: Share → Add to Home Screen; Android Chrome: Install app / Add to Home screen). It gets its own icon and name, and opens full screen like an app, without the browser bar.

**Done means.**
- The app serves a web app manifest (name, short name, icons including 192 and 512 px and a maskable one, theme and background colours, `display: standalone`, start URL) and an `apple-touch-icon`, plus the iOS meta tags for a standalone app (title, status bar style).
- Chrome's installability check passes (Lighthouse or DevTools → Application → Manifest shows no errors).
- With the phone offline, opening the home-screen web app shows the Ticker offline screen, and prices load again once back online.
- On a real iPhone and a real Android phone at ticker.allomos.com: added to the home screen, the icon and name look right, and the app opens standalone; signing in from the home-screen web app works with the code from A04-nose857.
- Layout respects the notch and home indicator (safe-area insets) in standalone mode.
- Tests and build pass; deployed to ticker.allomos.com.

**Notes.**
- Today the app has only `public/favicon.svg`; no manifest, touch icon or service worker.
- Decided by the approver (2026-10-31): name "Ticker"; icon made from the current `public/favicon.svg` for now (the approver will design a new icon in another session, so keep the icon files easy to swap).
- Decided by the approver (2026-10-31): offline, the home-screen web app shows a simple Ticker screen: "You're offline – prices will load when you're back online." (needs a small service worker that serves this page when the network fails).
- Decided by the approver (2026-10-31): signing in from the home-screen web app uses a long code from the sign-in email, pasted into the app; built in A04-nose857, which this task waits on. The human check includes signing in on iPhone from the home-screen web app with that code.
- Deploying to ticker.allomos.com is an outside effect: it waits for the approver's go-ahead.

## Evidence

- 2026-10-31, claude-code-29ed5bb1: Deployed to ticker.allomos.com 2026-11-01 ~00:18 JST from master fc11caf (code as of 1e0f94b) by claude-code-29ed5bb1 after the approver said 'Yes, deploy' in this session; Worker version 5d9e3470-5427-46ab-b2ea-3af59bb58485; no migration
