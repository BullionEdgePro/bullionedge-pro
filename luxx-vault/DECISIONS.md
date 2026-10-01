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

## 2026-09-30 — Logo: the owner's Luxx4less emblem (replaces the LV monogram options)
- The owner asked to use their own logo from Facebook. The three "LV" monogram options were retired (they also avoided an interlocking LV, which would read as Louis Vuitton's registered monogram).
- The logo is rebuilt as vector geometry from the 447px Facebook profile picture (`scripts/build-logo.ts` → `logo-data.ts`):
  - frame measured from the original: an upright square and a 45° diamond of equal size (the eight-point star) plus two concentric regular octagons, one line weight, flat peach gold `#E8BA88` sampled from the original;
  - the L from Bodoni Moda opsz 11 Black (SIL OFL): the closest free Didone to the original's L (heavy stem, curved beak on the foot). A metal stroke under the fill thickens its hairline serifs to match;
  - a channel of brilliant-cut stones down the stem (large stones with pairs of small ones, as on the original) and one stone at the foot;
  - wordmark in Cinzel, read with fontkit, because opentype.js returns NaN for a point in Cinzel's X and silently truncated the outline.
- `logo-svg.ts` draws it at three detail levels (full / simple for ≤48px / mono for watermarks and light backgrounds) and two lockups (stacked like the profile picture, horizontal like the cover). The same code feeds the React `Emblem`/`Lockup`, the icon and file build, and the 3D bar's stamp.
- Creative additions, all using the owner's mark unchanged: a foil finish of the frame, a "living" emblem (frame draws in, stones twinkle in sequence; still under reduced motion), and the gold bar stamped with the emblem like a refinery hallmark.
- `npm run brand:icons` writes the favicon, app icons and downloadable files (`public/brand/luxx4less-*.svg` and a 1080px PNG).
- Branch addresses, follower counts and sibling pages were taken from the owner's Facebook cover into `src/config/brand.ts`.

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

## 2026-09-30 — Shareable review preview (Phase 1 only)
- The owner can't run the dev server, so Phase 1 went out as a private claude.ai preview link built from a static export. Retired in Phase 2: accounts need a live server, so reviews now happen on Vercel (DEPLOY.md). The published Phase 1 preview stays as it was.
- The build is a static export (`PREVIEW_EXPORT=1`, webpack) turned into single self-contained HTML files by `scripts/build-preview.ts`: each page's own chunks and the on-demand 3D chunks as separate inline scripts (runtime last), CSS inlined with fonts and images as data URIs, and internal links rewritten to sibling files. A tiny `document.currentScript` shim covers Next's asset-prefix check, which expects a script `src`.
- Tested from an unfamiliar deep path at desktop and phone widths: the page hydrates, the theme toggle, karat switch and page link all work, the WebGL bar renders under `?motion=full`, and there are no page errors. The only remaining requests (the original CSS path, a link prefetch) are for files the pages don't need.

## 2026-09-30 — One name: Luxx4less
- The owner decided to use **Luxx4less** everywhere instead of a separate "Luxx Vault" platform name. `brand.siteName` drives page titles; docs were updated. The project folder is still `luxx-vault/` until it moves to its own repository.

## 2026-09-30 — Phase 2: accounts and security
- **Stack:** Better Auth 1.7 + Prisma 7 (pg driver adapter) on PostgreSQL. Local development uses the machine's Postgres 16; production uses Neon through Vercel's Storage integration (`DATABASE_URL` pooled for the app, `DATABASE_URL_UNPOOLED` for migrations, see `prisma.config.ts`).
- **Schema:** auth tables generated by the Better Auth CLI for our exact plugin set (twoFactor, passkey, admin, rate limit), plus `consent_record` (Data Privacy Act evidence, append-only), `audit_log` (append-only) and `dev_email` (mock mailbox).
- **Passwords:** Argon2id with the OWASP parameters (m=19456, t=2, p=1), 10–128 characters, breached-password check via HIBP (k-anonymity), switchable with `HIBP_CHECK` because the build environment can't reach the API.
- **Email verification:** required before any session; links expire in 24 h. Better Auth's tokens are signed, not stored, but a reused link never creates a second session (checked in the library: an already-verified user is only redirected), so each link signs you in once. Sign-in with an unconfirmed email asks for a fresh link itself, so it lands on the welcome screen (`sendOnSignIn: false`).
- **No account enumeration:** sign-up with an existing email returns a normal-looking success (Better Auth's synthetic user), and the real owner gets an email; password reset answers the same whether or not the account exists.
- **Consent (brief §12):** Terms, Privacy Notice and 18+ are enforced server-side in a `before` hook on `/sign-up/email` (not just the checkbox), and recorded with policy version, IP and user agent. Marketing is optional and recorded either way.
- **Roles:** seven roles registered with Better Auth's access control, least privilege (only super_admin can impersonate, delete users or set passwords). `requireRole()` gates pages server-side and sends sellers/staff without 2FA to turn it on first.
- **Two-step sign-in (TOTP) with backup codes, passkeys, device list with remote sign-out, password change (signs out other devices).** Security emails and audit entries for: new device sign-in, 2FA on/off, backup codes regenerated, passkey added/removed, password changed or reset.
- **Rate limits (database-backed):** sign-in 5/min, sign-up 5/10 min, reset and verification emails 3/10 min, 2FA codes 5/min. E2E setup clears the counters on local databases only.
- **Email:** provider interface with Resend and a mock that stores mail for `/dev/mailbox`. The mailbox exists only in mock mode, and on a public URL needs `?key=MAILBOX_KEY` (it shows sign-in links). A public deployment refuses to start with mock email unless `ALLOW_MOCK_EMAIL_IN_PRODUCTION=true` and a mailbox key are set. A banner marks test mode on every page.
- **Server env** is validated with zod at first use. On Vercel, `BETTER_AUTH_URL` defaults to the production domain (production) or the branch URL (previews).
- **Deferred:** Cloudflare Turnstile on sign-up/sign-in (needs keys; Better Auth's captcha plugin is ready to switch on), new-*location* alerts (needs an IP-geolocation service), full legal texts (drafts at `/terms` and `/privacy` are marked pending lawyer review).

## Phase 2.5 — the people page (30 Sep 2026)

**A separate `/about` page, not the home page.** The home page is Phase 3 and needs the price
engine. The owner's photos were ready now, so they got their own page rather than waiting.

**A photo with a bank account number was withheld.** One guest photo had an EastWest account
number and name printed across it. The brief forbids bank account numbers anywhere in the UI, and
a published account number invites payment fraud against the shop. It was moved to
`brand-assets/_withheld/`, which the pipeline never reads. `PHOTO/modes of payment/eastwest.jpg`
was never imported for the same reason. Payment details belong behind sign-in at checkout.

**No names, no quotes, no invented history.** The photos show the founder at an awards night and
on DZAR Sonshine Radio, and the team in a studio session. We know what the rooms were; we do not
know anyone's name. `src/content/people.ts` leaves `FOUNDER.name` and the pull quote blank and the
page simply omits them until the owner fills them in — a placeholder name would be a fabricated
fact about a real person.

**Recognition is described, never claimed.** The awards photo says "on the carpet, representing
the shop", not that the shop won anything. We only know she attended.

**The Makati branch is hidden until confirmed.** It is printed on the shop's paper bags, so it is
real, but a stale address sends customers to a closed door. `brand.branches` carries it with
`confirm: true`, and both the page and the footer filter those out.

**Motion is built from three primitives, not per-section one-offs.** `Reveal` (rise out of blur),
`RisingWords` (words lift into place) and `GoldRule` (a hairline drawing itself across), plus
`ParallaxFrame` for photos. Every one returns plain markup under `prefers-reduced-motion`, and
`RisingWords` keeps the whole sentence in a visually-hidden span so screen readers and copy-paste
get one string, not loose words.

**Photos are framed, not cropped, and focal points are explicit.** `BrandImage` takes a `focus`
prop because the storefront photo is a portrait selfie whose sign sits in the top tenth — a
centred crop threw the shop name away. It also throws at build time if a page names a photo that
is not in `brand-assets/`, so a missing file fails the build instead of leaving a hole on the
live site.

**The guest wall duplicates its rows and hides the copy from assistive tech.** A seamless marquee
needs two copies of the strip; `aria-hidden` on the whole thing stops screen readers reading
twenty-four decorative photos twice. Under reduced motion it becomes a still, swipeable strip.


## Phase 2.5 follow-up — names, consent and brand lines (30 Sep 2026)

**The founder is named; the team is not.** The owner gave the founder's name (Lovely Joy Serrano)
and confirmed all nine staff agreed to appear, but chose group photos without individual names.
Fewer names on a public page means fewer people a scammer can impersonate in a DM.

**The guest wall is off, and its photos are out of the build.** Hiding the section was not enough:
the processed files would still be served from `public/images/visits/` to anyone who guessed the
URL, and the repository is public. The originals moved to `brand-assets/_awaiting-consent/`
(the pipeline only reads its listed folders), and the unpushed commit that added them was amended
so they never reach GitHub.

**Invented history removed.** "She started with one tray", "outgrew its first counter" and "the
600,000th follower" were written as colour but read as facts about a real business. The founder
copy now states only what is known (founded 2019, Antipolo, a second branch in Ongpin, on air at
DZAR) and leans on the brand lines in `src/content/lines.ts`.

**Brand lines as a scroll-lit band** (`BrandLines`): each line catches the light in turn as the
band passes, driven by scroll position rather than a timer, so it never moves faster than the
reader. Under reduced motion every line is simply lit.

## Dark only, English only, a grander header (30 Sep 2026)

**Dark only (owner's choice).** The theme toggle is gone and next-themes is forced to dark; the
velvet tokens are now the root default, so there is no flash of light before hydration. The light
tokens stay in `tokens.ts` as the record the contrast tests check, but nothing renders them.

**English throughout (owner's choice).** The Taglish brand lines were rewritten in English
("Real gold. Verified people.", "It shines because it is real."), and so were the page mottos,
the account welcome and the confirmation email. This overrides the brief's Taglish voice note;
next-intl (Phase 7) can still add Filipino later as a separate language.

**The header is an entrance, not a toolbar.** Tall (128px) and open at the top of a page, with the
crest centred between the nav and the sign-in actions; after 32px of scroll it settles into an 80px
band of smoked glass. A gold thread along its lower edge fills with reading progress. Nav links
draw a gold underline from the centre. On phones the nav becomes a full-screen velvet menu that
opens as a widening circle from the button. `/about` floats the header over its opening photo.

**Atmosphere, kept quiet.** A 5% film grain over every page (velvet has a nap), a faint lamp glow
at the top of the page, a single band of light across gold buttons on hover, and photos that lean
in slowly with a mat line appearing on hover. All of it is decoration only: no layout shift, and
reduced motion turns the moving parts off.

## The full build before launch (30 Sep – 1 Oct 2026)

The owner chose to build everything before going live: prices, verification and the marketplace,
plus four new ideas (trade tape, Viber/Messenger alerts, seller showrooms, hallmark scanner).

**Prices.** gold-api.com (no key) for spot, open.er-api.com and Frankfurter (ECB) for USD/PHP, with a
divergence note when they disagree by more than 1.5%. No always-on timer: a request refreshes prices
when they are over a minute old, plus a daily Vercel cron (Hobby allows one a day). A move over 8%
within two hours is held back as a bad tick. "Prices delayed" after 10 minutes without a check;
"Markets closed" at the weekend, when Friday's close is the right price. Stooq was rejected (it sits
behind a bot challenge). History needs a free gold-api.com key; until then the charts say how far back
our own readings go instead of drawing anything we don't have.

**No invented shop prices.** "We buy at / We sell at" appear only after the owner sets spreads in
/admin/prices. Until then pages say shop prices are confirmed in store.

**Verification runs on labelled test providers.** SMS codes show on screen ("no SMS was sent"); ID
photos are checked on the device and never uploaded; every application waits for a staff decision.
Real providers plug into `SmsProvider` (Semaphore adapter written, untested) and `KycProvider`. A
public deployment refuses the mocks unless ALLOW_MOCK_SMS/KYC_IN_PRODUCTION=true, which the test
deployment sets on purpose, like mock email.

**Marketplace.** One account for everyone (the reference makes people choose buyer or seller forever).
Buying, offers and chat need Tier 3; selling needs Tier 4 and two-step sign-in. Every money step is a
compare-and-set update, so two clicks can't both accept or both pay. The payment hold is a mock
provider ("Test mode: no money moves") behind a `PaymentProvider` interface for PayMongo or Xendit
split payments; Luxx4less never holds funds itself (brief §9). Messages are scanned for phone
numbers, account numbers, off-platform payment phrases and outside links, and both sides see the
warning. Photos are re-encoded, stripped of metadata, watermarked with the emblem and listing code,
and compared by perceptual hash against other sellers' photos.

**Trade tape** shows only released trades, anonymised (item, karat, weight, city, ₱/g rounded to ₱10),
and either side can hide theirs. It starts empty: no sample trades are ever shown.

**Alerts** fire on a crossing with a 12-hour rest. Messenger is used only inside Meta's 24-hour
window (price alerts fit none of Meta's message tags); outside it, and whenever Viber or Messenger
fails, the alert goes by email.

**One hydration lesson.** A `<style href precedence>` tag in the header ticker silently stopped every
page from hydrating. Keyframes now live in globals.css, and `@/hooks/use-reduced-motion` replaces
motion's hook, which answered differently on the server and the first client render.

## Header: Buy / Sell, Get the app, no test-email banner (1 Oct 2026)

**Test-email banner removed (owner's choice).** Until SMTP_PASSWORD is set in Vercel, email still runs in
test mode: confirmation and alert emails go to the private on-site mailbox, so new customers can't confirm
their sign-up. The banner said so on every page; the owner preferred a clean header. Real email (Gmail SMTP
from info.luxx4lessph@gmail.com) is wired and switches on with that one setting.

**Buy / Sell switch** leads the desktop header: an engraved pill with a sliding gold half and a light that
circles its border; each half opens a panel of what buyers or sellers can do. On phones the menu opens with
the same two choices as cards. **Get the app** sits on the right with a QR code for desktop visitors, and
hides inside the installed app. **Facebook followers** updated to 818,060 from the page itself.

## Official Shop (1 Oct 2026)

The owner wants to sell the shop's own jewellery on the site. It is built as the **Official Shop** (brief §9,
Phase 4), separate from the marketplace: `/shop`, product pages, a bag, checkout, orders and layaway, run by
admins from `/admin/shop` and `/admin/orders`. The shop's own pieces have no seller limits and need no seller
verification. The marketplace keeps its rules.

**How buyers pay (owner's choice): in store, GCash/bank transfer with a receipt upload, and cash on delivery
or meet-up.** No payment company is involved, so there are no fees and nothing is in test mode. Money still
moves outside the website: staff confirm each receipt against the real account before an order moves on.
PayMongo or Xendit can be added later as a fourth method.

**Payment details are never in code or on public pages.** The brief forbids account numbers in the UI. The
owner types them in `/admin/shop/settings`. They are stored in the database and shown only to a buyer on
their own order page, after they order, with a warning that Luxx4less never sends other details by chat. A
change to them is the classic way to divert a shop's money, so every admin is emailed when they change.
The audit log records that they changed, never the text itself.

**Stock is held when an order is placed** (in the same database transaction, so two people can't buy the
last piece). Unpaid orders cancel themselves after the hold (3 days by default) and the pieces go back on
sale. A receipt waiting for staff stops that clock. One person can have at most three unpaid orders at a
time.

**Prices lock when the order is placed.** Spot-pegged pieces move with the market until then. If the price
moves while someone is on the checkout page, they are told the new total and asked to place the order
again.

**Tiers:** the bag needs a confirmed email (Tier 1) and checkout a verified mobile number (Tier 2). Orders
over ₱100,000 need an ID-verified account (Tier 3), per the brief's "Tier 2: small amounts".

**Defaults the owner should confirm** (all editable in shop settings): hold unpaid orders 3 days; layaway
30% down then 3 monthly payments, from ₱5,000; cash on delivery on with no limit; delivery fee quoted per
order. Layaway reminders go out by email three days before each payment is due (daily cron).
