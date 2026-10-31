**Outcome.** A signed-in user sees the whole app (lists, search, ticker pages, menus) in the same colours as www.allomos.com, in light and dark, with price rises and falls still in green and red.

**Done means.**
- `src/app/styles.css` colour tokens follow the Allomos palette: light background #fbfcfe, surface #ffffff, text #12223a, muted #55667c, lines #e2e7ee, links #1f7a6f; dark background #0e1726, surface #152136, text #e8edf4, muted #9aa8bb, lines #26344c, links #5cc8ba; main accent teal #2a9d8f (buttons, focus, chart line), coral #e76f51 and gold #e9c46a as secondary accents.
- `--up` / `--down` stay green and red (#137333 / #c5221f, dark #81c995 / #f28b82).
- The price chart, search box, list tabs, add-to-list menu and user menu all read well in light and dark; text contrast meets WCAG AA.
- Checked in the browser at desktop and phone width; tests and build pass; deployed to ticker.allomos.com after the approver's go.

**Notes.**
- Approver, 2026-10-31: the signed-in screens move to the Allomos colours too; rises and falls stay green and red.
- Shares the palette with A01-hinge715 (signed-out pages) and the logo A01-grotto889 (B2). Doing this one with or right after A01-hinge715 keeps both on the same tokens.
- Approver made the task ready on 2026-10-31. Still open for the approver: the go to deploy (outside effect).

## Evidence

- 2026-10-31, claude-code-29ed5bb1: Deployed to ticker.allomos.com 2026-11-01 ~00:05 JST from master ec2fb5d by claude-code-29ed5bb1 after the approver said 'Yes, deploy' in this session; Worker version 69ae9d14-c449-409b-8750-42653524d8cb; no migration
