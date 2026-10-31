**Outcome.** On a phone, a user adds Ticker to the home screen (iPhone Safari: Share → Add to Home Screen; Android Chrome: Install app / Add to Home screen). It gets its own icon and name, and opens full screen like an app, without the browser bar.

**Done means.**
- The app serves a web app manifest (name, short name, icons including 192 and 512 px and a maskable one, theme and background colours, `display: standalone`, start URL) and an `apple-touch-icon`, plus the iOS meta tags for a standalone app (title, status bar style).
- Chrome's installability check passes (Lighthouse or DevTools → Application → Manifest shows no errors), with a small service worker if Chrome still needs one to offer installation.
- On a real iPhone and a real Android phone at ticker.allomos.com: added to the home screen, the icon and name look right, and the app opens standalone; sign-in by email link still works from the home-screen app.
- Layout respects the notch and home indicator (safe-area insets) in standalone mode.
- Tests and build pass; deployed to ticker.allomos.com.

**Notes.**
- Today the app has only `public/favicon.svg`; no manifest, touch icon or service worker.
- Open for the person (what users will see):
  1. Name under the icon: "Ticker"? Icon: made from the current favicon, or a new design?
  2. Offline: only make it installable (prices need the network anyway), or also show a cached page / "offline" message when there is no connection?
- Sign-in links from email open in the phone's browser, not in the installed app (iOS keeps them separate); the human check must confirm the session reaches the home-screen app, or the task must say how a user signs in there.
- Deploying to ticker.allomos.com is an outside effect: it waits for the approver's go-ahead.
