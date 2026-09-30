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

## 2026-09-30 — Phase 1: stack and setup
- Next.js 16 (App Router, React 19, TypeScript strict with `noUncheckedIndexedAccess`), Tailwind CSS 4, ESLint 9 flat config with `eslint-config-next` (React Compiler rules on), Vitest.
- shadcn/ui's registry is unreachable from the build environment, so `Button`, `Badge` and `Card` are written by hand in shadcn's own pattern (cva + Radix Slot, `src/components/ui`, `components.json` present). The CLI can add more components later; all are restyled to our tokens.
- Baseline security headers in `next.config.ts` (HSTS, nosniff, frame DENY, referrer policy, permissions policy with camera off). The nonce-based CSP comes in Phase 9, once all third parties are known.

## 2026-09-30 — Colour tokens and contrast
- Tokens live in `src/config/tokens.ts`, mirrored as CSS variables in `globals.css`. `tokens.test.ts` asserts every text/background pairing the UI uses meets WCAG AA.
- Three brief colours fail AA as text, so derived shades were added (the brief colours stay for fills and large text):
  - `bullion` on pearl is 3.1:1 → **bullion-ink `#7A5B22`** (5.5:1) for small gold text on light.
  - `ice` on pearl is 1.3:1 → **ice-deep `#2F6F8A`** (4.9:1) for the focus ring on light. Ice stays the ring on velvet.
  - Status colours get darker "ink" shades for text on light and brighter "glow" shades for text on dark.
- Dark mode is a `.dark` class (next-themes, follows system by default). `.surface-velvet` re-declares the dark tokens locally, so hero and market sections stay velvet in either theme.

## 2026-09-30 — Display font: Cinzel (owner's choice)
- The owner wanted Luxury Gold (House Industries), a paid commercial font. We didn't download it from "free font" sites: those copies are unlicensed. The owner chose a free look-alike; after a comparison sheet (`docs/fonts/luxury-gold-alternatives.png`), they picked **Cinzel** (SIL OFL). It replaces Bodoni Moda, which also lost its hairlines at heading sizes.
- Cinzel is a capitals face: lowercase renders as small capitals. Source text stays in sentence case (per the brief), but headings read as refined capitals. This is a deliberate owner choice over the brief's "no all-caps" note.
- **Cinzel has no ₱ glyph.** `scripts/build-peso-font.ts` builds a one-glyph "Luxx Peso" font per weight from Cinzel's own P plus two bars (wound to match the outer contour, so the nonzero fill leaves no holes). It comes first in the display stack, so the browser takes only ₱ from it. Loaded with `adjustFontFallback: false`, otherwise next/font's generated Arial fallback would cover every other character and hide Cinzel. Plus Jakarta Sans loads its `latin-ext` subset, which carries ₱.
- Cinzel has no tabular figures. Tables and data use Jakarta's; the hero's rolling reels are sized per digit from Cinzel's measured advance widths.

## 2026-09-30 — Monograms
- Built from real Cinzel glyph outlines (`scripts/build-monograms.ts`), in three frames: Hallmark (assay-stamp cartouche), Karat dial (24 ticks), Ingot (letters cut from a bar).
- **L and V always stand side by side, never interlocked:** an interlocking LV reads as Louis Vuitton's registered monogram.
- Favicon and app icons come from the chosen option (`npm run brand:icons -- a|b|c`). Option C is a placeholder until the owner picks.

## 2026-09-30 — Hero ("The Living Gram")
- The price numerals use a gradient clipped to the text (`background-clip: text`). Chrome leaves transformed or positioned descendants out of that clip, so the digit reels roll with a negative `margin-top` (no transform, no positioning), and the root is clipped to one 1em line.
- `tailwind-merge` drops a `leading-*` class when a text-size class follows it, so the rolling number sets `line-height: 1` inline.
- The shimmer gradient is periodic (same first and last colour, 90°, tiled every 200%), and the animation moves exactly one tile, so it loops with no seam.
- 3D bar: react-three-fiber, a RoundedBox tapered like a cast bar, and a canvas-drawn refinery stamp redrawn once Cinzel loads. Lighting comes from in-scene light panels plus a warm base colour, so polished gold never reflects black; no HDRI download. three.js loads only via `next/dynamic` on "full"-tier devices.
- The DOM measures the free zone between the numerals and the controls; the scene fits and places the bar there (`bar-layout.ts`, kept outside the three.js module so it doesn't pull three into the main bundle).
- Scroll: Lenis + one GSAP ScrollTrigger (start top/top, end bottom/bottom, so progress reaches 1 exactly when the pin releases). The bar turns, then settles as the controls fade out.
- Motion tiers (`use-motion-tier.ts`): **static** (reduced motion) and **lite** (≤4 cores, <4 GB memory, save-data or no WebGL2) get a still render of the real scene (`public/brand/gold-bar-poster.webp`, made by `npm run screenshots`). `?motion=full|lite|static` forces a tier for QA.
- The hero's price is a clearly labelled sample (`src/lib/sample-price*.ts`) until the Phase 3 price engine.

## 2026-09-30 — Brand photo pipeline
- `npm run images`: sharp auto-orients from EXIF and then strips all metadata (tested: a sideways 3000×2000 photo with GPS came out upright with no EXIF), exports responsive AVIF + WebP without upscaling, makes blur placeholders, writes `src/content/images.ts`, and lists empty folders in TODO.md.
