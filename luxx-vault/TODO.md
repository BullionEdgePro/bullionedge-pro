# TODO

## ▶ Resume here (paused 1 Oct 2026, ~02:40 Manila)
Nothing is pushed or deployed yet. All work is in local commits on `claude/hopeful-gates-06x3c8`.
- **Done and reviewed:** prices engine, /prices, /tools (calculator, price check, hallmark reader), /sell,
  /admin/prices, home page, header ticker; verification (phone, ID, seller, /admin/kyc); price alerts
  with email/Viber/Messenger; installable app + /install + /offline.
- **Marketplace: built but UNREVIEWED** (last commit "WIP marketplace"). Stopped while writing the
  listing edit page. Typecheck was clean. Next: finish listing edit, review security (tiers, ownership,
  2FA for sellers), switch its files to `@/hooks/use-reduced-motion`, check no `<style precedence>`.
- **Then:** full browser run (sign-up → verify → list → offer → chat → trade → review) at 390px and
  desktop; update PARITY.md; deploy with the Vercel CLI (project `luxx4less`, Neon `luxx4less-db`
  already connected, env secrets set; add CRON_SECRET); open the live site in Edge; push.
- **Owner to answer:** keep college ID (18+) in the accepted-ID list? (`src/config/kyc.ts`)
- **Owner accounts later:** free gold-api.com key (20-year history), Semaphore (SMS), Viber bot /
  Facebook Page app (alerts), a KYC vendor and PayMongo/Xendit before real trading.
- Local: Postgres runs in docker `luxx-pg`; `npm run dev:users` recreates test accounts.

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
