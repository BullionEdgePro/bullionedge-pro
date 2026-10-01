# TODO

## Live (1 Oct 2026)
- **https://luxx4less.vercel.app** — Vercel project `luxx4less` (team LUXX4LESS, dezekielshop), Neon
  `luxx4less-db` (Singapore). Deployed with the Vercel CLI (`npx vercel deploy --prod` from `luxx-vault/`):
  the Vercel account has no GitHub login, so pushes don't deploy by themselves yet.
- Test modes on the live site, each labelled on screen: email (mailbox at /dev/mailbox?key=MAILBOX_KEY),
  SMS codes, ID checks, face checks, payments, Viber/Messenger alerts.
- Tests: `npx vitest run` (383), `e2e/marketplace.spec.ts` (12), `e2e/face-check.spec.ts` (2), `e2e/shop.spec.ts` (7) and the phone audit `e2e/mobile-audit.spec.ts` (46 pages) —
  see the headers of those files for the env vars they need. Local databases only.
- Owner to set up when ready: free gold-api.com key (GOLD_API_KEY, 20-year charts), SMS (free: SMSGate app on a shop Android phone; paid: Semaphore),
  a KYC vendor with face re-verification, PayMongo or Xendit, Resend + domain email, Viber bot / FB Page
  app, and a GitHub login on the Vercel account for automatic deploys.
- Accepted IDs: government-issued only (owner, 1 Oct 2026).
- **Official Shop** (1 Oct 2026): `/shop`, run from Staff › Official shop and Shop orders. Owner to do:
  add GCash/bank details in Official shop › Shop settings (transfer stays off until then), check the
  layaway and hold defaults there, then add the first pieces with photos. `e2e/shop.spec.ts` (7) is the
  full test purchase.

## Phase 0 — checkpoint
- [x] Crawl metalmarketph.com (12 routes, 1440 + 390 screenshots)
- [x] AUDIT.md and PARITY.md from the crawl
- [x] Owner review (approved)

## Phase 1 — checkpoint
- [x] Next.js + TypeScript + Tailwind setup, tokens with AA contrast tests
- [x] Display font Cinzel with custom ₱ glyph; Plus Jakarta Sans for UI
- [x] Buttons, badges, cards, theme toggle, magnetic CTA, card spotlight
- [x] Owner's Luxx4less logo rebuilt as vector (full / small / single-colour, stacked + horizontal lockups, living emblem); favicon, app icons and logo files
- [x] Hero prototype: rolling price, karat chips, 3D bar with scroll scene, still fallback
- [x] Brand photo pipeline (`npm run images`)
- [ ] Owner checks the redrawn logo against the original (and sends the designer's original file if available, for the sharpest match)
- [ ] Owner approves look and feel (Checkpoint 1)

## Phase 2 — checkpoint
- [x] PostgreSQL + Prisma schema and migration; Better Auth with email verification, Argon2id, breached-password check, TOTP 2FA + backup codes, passkeys, roles, rate limits, device list, security alerts, consent records, audit log
- [x] Branded emails (confirm, reset, security alert) with Resend and mock providers; test mailbox
- [x] Pages: sign-up, sign-in, two-step code, forgot/reset password, verify email, account, security; draft Terms and Privacy
- [x] Unit tests (46) and Playwright E2E: sign-up → confirm email → sign in → 2FA on → sign in with code
- [ ] Owner deploys to Vercel (DEPLOY.md) and tries the flow
- [ ] Owner approves (Checkpoint 2)

## Phase 2.5 — the people page
- [x] Owner, team, storefront and guest photos processed (GPS/EXIF stripped, AVIF + WebP)
- [x] `/about` "Behind the counter": storefront hero, founder, team fan, press, guest wall, footer
- [x] Consent: all 9 staff in the team photos agreed to appear (owner, 30 Sep 2026). Shown unnamed, by the owner's choice
- [ ] **Consent: each identifiable guest/creator on the wall must agree.** The wall is off
      (`VISITS.published = false`) and its 12 photos wait in `brand-assets/_awaiting-consent/`;
      see the README there to turn it back on
- [x] Founder credited as **Lovely Joy Serrano, Founder** (owner, 30 Sep 2026)
- [ ] A real quote from the owner → `FOUNDER.pullQuote`
- [ ] Is the Makati address (7721 JB Roxas cor. JP Rizal) still open? It is on the paper bags but
      hidden on the site until confirmed — see `brand.branches`
- [ ] Confirm the numbers printed on the paper bags (`brand.contact.packaging`) and the
      `luxx4less.ph8` handle

## Owner to provide
- [ ] Product photos (`brand-assets/products/`) and customer screenshots (`testimonials/`)
- [ ] Resend account + domain for real emails (DEPLOY.md step 7)
- [ ] Cloudflare Turnstile keys (free) for bot protection on sign-up/sign-in
- [ ] Lawyer review of the Terms and Privacy Notice drafts; Data Protection Officer name

## Deferred from Phase 1 (planned later)
- [ ] Pre-rendered WebP frame sequence for "lite" devices, instead of one still (Phase 9 motion polish)
- [ ] Odometer-style wrap for the digit reels (e.g. 0→9 steps back one instead of spinning through), Phase 9
- [ ] Header price ticker marquee, Phase 3 (needs the price engine)
- [ ] English/Filipino i18n (next-intl) and header language toggle, Phase 7
- [x] Recreate the existing Luxx4less logo as SVG

## Environment
- [ ] Allow `api.gold-api.com` in Network access (the price API is on the `api.` subdomain; `gold-api.com` alone isn't enough). Needed for Phase 3.
- [ ] Pick and allow second spot and FX sources for failover (Phase 3)

## Owner decisions / confirmations
- [ ] Project home: keep in `luxx-vault/` here, or create a dedicated repository (recommended)
- [x] Name: "Luxx4less" everywhere (owner, 30 Sep 2026)
- [ ] Business model: free to join? fees on marketplace trades?
- [ ] Review FEATURES.md: approve, cut or reprioritise; confirm Luxx-Tested fee, consignment terms, buyback rate, reseller commission
- [x] Antipolo and Ongpin branch addresses, Facebook follower counts (from the cover)
- [x] `luxx4less.ph` is on the storefront sign (photo, Sep 2026) — still confirm it is the web domain
- [x] Legal name is **LUXX4LESS TRADING OPC** (from the shop's own payment card)
- [x] Packaging tagline: "Luxury within your reach"
- [ ] Links to the Ongpin, Venus, Earth and Mercury Facebook pages
- [ ] Email (domain email recommended), phone numbers, Lazada store URL, Messenger channel link

## Brand assets (owner)
Save into `brand-assets/` (raw photos are git-ignored; only processed output is committed):
- [ ] `logo/`: profile picture and any logo files
- [ ] `cover/`: Facebook cover photos
- [ ] `products/`: rings, necklaces, bracelets, earrings, bars
- [ ] `store/`: shop, team, packaging, live-selling
- [ ] `testimonials/`: only with customer permission

<!-- missing-photos:start -->
### Photos still needed (generated by `npm run images`)
- [ ] `brand-assets/cover/` — Facebook cover photos
- [ ] `brand-assets/visits/` — Guests and creators who visited a branch — each person must agree to appear
- [ ] `brand-assets/products/` — Product photos: rings, necklaces, bracelets, earrings, bars (plain light background preferred)
- [ ] `brand-assets/testimonials/` — Customer screenshots — only with each customer's permission
<!-- missing-photos:end -->
