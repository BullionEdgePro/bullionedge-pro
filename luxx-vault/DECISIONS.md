# Decisions

## 2026-09-30 — Project location
The owner asked for the project to live in `C:\CLIENT FILES\LUXXE4LESS`. This build runs in a cloud container that can't see that Windows folder, so the project is kept self-contained in `luxx-vault/` on branch `claude/hopeful-gates-06x3c8` of the `bullionedge-pro` repository. To work locally, clone that branch and copy `luxx-vault/` into `C:\CLIENT FILES\LUXXE4LESS`. Proposed follow-up: move it to its own repository (e.g. `luxx-vault`) before Phase 1, so it never ships with the BullionEdge Pro site.

## 2026-09-30 — Reference crawl tooling
- Playwright with a plain script (`scripts/audit-reference.ts`, run through `tsx`) rather than a crawling framework: one site and a few dozen routes.
- Politeness: robots.txt is parsed per RFC 9309 (longest match wins, Allow wins ties, Crawl-delay honoured). Page navigations are spaced at least 1 s apart. The page's own sub-resources load normally.
- SPA route discovery: rendered `<a href>` links, `sitemap.xml`, plus 30 common route guesses. A guess is kept only if its rendered content differs from a deliberate 404 probe and from every page already kept. That's how hidden routes such as `/login` are found without false positives.
- Screenshots use `reducedMotion: "reduce"` so animations don't blur captures, and the page is scrolled once first to trigger lazy content.
- Tested against a local mock SPA (robots Disallow, hidden route, 404 fallback, XHR capture), then run against the reference on 2026-09-30.
- robots.txt and sitemap.xml are fetched through the browser, not Node's `fetch`, so they take the same network path as the pages. If robots.txt is unreachable or returns 5xx, the crawl stops (RFC 9309) rather than assuming everything is allowed.
- A navigation that fails (error page, timeout) is recorded as skipped, never as a route. If the start page fails, the whole crawl aborts.
- Blocking consent dialogs ("I agree", "Accept"…) are clicked before capture, and the click is recorded per page.
- Elements a scroll-reveal library left at inline `opacity: 0` + `transform` are forced visible before full-page screenshots, since a full-page capture never scrolls them into view.
- Pages are compared with digits stripped when detecting not-found and duplicate pages, so live price tickers don't make identical pages look different.
