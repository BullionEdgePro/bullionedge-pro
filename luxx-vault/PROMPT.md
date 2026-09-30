# LUXX VAULT — Master Build Prompt for Claude Code

> How to use: save this file in the root of an empty project folder as `PROMPT.md`, put the brand photos in `/brand-assets` (see section 4), open Claude Code in that folder, switch to Plan Mode, and say:
> **"Read PROMPT.md fully. Start Phase 0 and stop at the checkpoint."**

---

## 0. Your role and how you must work

You are a senior full-stack engineer and award-level product/web designer building a production-grade precious-metals marketplace for a real Philippine business. Work like a careful lead engineer:

- Build in the phases listed in section 16. **Stop at every checkpoint**, summarize what you did, show screenshots of UI work, and wait for my approval before continuing.
- Never invent facts about the business. Anything marked `[CONFIRM]` must be kept in `src/config/brand.ts` so I can edit it in one place.
- Never commit secrets. Every key goes in `.env.local`, and `.env.example` documents each one.
- Never fake security. If a feature needs a third-party service (KYC, payments, email), build a clean provider interface plus a **mock adapter for development**, and clearly label mock mode in the UI with a visible banner.
- When blocked or when two approaches have real trade-offs, ask me instead of guessing.
- Keep a running `DECISIONS.md` (why you chose things) and `TODO.md` (what's left).

---

## 1. The business (source of truth)

Put all of this in `src/config/brand.ts`:

| Field | Value |
|---|---|
| Legal name | LUXX4LESS GOLDS AND DIAMONDS OPC |
| Public brand | Luxx4less Golds and Diamonds |
| Platform name | **Luxx Vault** (full: "Luxx Vault by Luxx4less") `[CONFIRM]` |
| Tagline (EN) | "Legit gold since 2019." |
| Tagline (Taglish) | "Tunay na ginto. Verified na tao." |
| Established | 2019 |
| Location | Antipolo City, Rizal, Philippines (full address `[CONFIRM]` before publishing) |
| Trademark colors | Black and gold (registered mark) |
| Category | Supplier/wholesaler + retail of gold, diamonds, and precious-metal jewelry; reseller network; Facebook live selling |
| Social proof | ~722K Facebook page likes, ~87K Instagram followers `[CONFIRM current numbers]` |
| Facebook | https://www.facebook.com/luxx4less.phgoldsanddiamonds |
| Instagram | @luxx4less.golds.and.diamonds |
| Email | luxx4less.ph@gmail.com `[CONFIRM — recommend a domain email]` |
| Phones | Admin 0917 192 5982 · Finance 0917 192 8792 · Dispatch 0917 882 9694 `[CONFIRM]` |
| Reseller channel | Messenger broadcast channel (link in brand config) |
| Also sold on | Lazada `[CONFIRM store URL]` |

Do NOT hardcode any bank account numbers anywhere in the UI. Payments go through the payment system in section 9.

---

## 2. Phase 0 — Audit the reference site first

Reference: **https://www.metalmarketph.com/** — it's a client-rendered React SPA, so plain HTTP fetches return only meta tags. You must render it.

1. Install Playwright and write `scripts/audit-reference.ts` that crawls the reference site (respect robots.txt, go slowly, max 1 request/second), discovers every internal route, and for each route saves a full-page screenshot at 1440px and 390px widths into `/audit/screenshots`.
2. Produce `AUDIT.md` with:
   - Sitemap of every route found
   - Feature inventory (every button, form, filter, tool, table, chart, auth step)
   - UX strengths worth matching and weaknesses we will beat (performance, accessibility, trust signals, mobile, copy)
   - Their data sources (from my research they cite gold-api.com and open.er-api.com, cross-referenced with GoldPrice.org PH)
3. Produce `PARITY.md`: a checklist table of **every** reference feature → our equivalent → our upgrade. Every row must be implemented before launch.

What I already know the reference has (verify and expand):
- P2P marketplace for gold, silver, precious metals, and gemstones with "verified buyers" and "secure transactions"
- Live prices: Gold (XAU), Silver (XAG), Platinum (XPT) in ₱/gram plus USD/oz spot, USD/PHP rate, troy-oz conversion note, last-updated timestamp, source links
- Karat conversion tables
- Educational resources and FAQ (red flags when buying gold, how professionals test gold: XRF, acid kits, electronic testers, loupes, precision scales, diamond testers)
- Dark theme (#0b0b0f) — **we will deliberately NOT copy this look** (see section 5)

**Do not copy their code, copy text, images, or layout.** We match features, not expression. All our copy is original.

⛔ CHECKPOINT 0: show me AUDIT.md, PARITY.md, and a few key screenshots.

---

## 3. What we're building

A trusted Philippine marketplace and storefront where:
1. **Luxx4less sells directly** (official store — the flagship, always featured first), and
2. **Verified third-party sellers and buyers trade** precious metals and gems, with identity-verified accounts on both sides, and
3. **Anyone can check live prices, calculate gold value, learn, and book an appraisal.**

Primary audience: Filipino buyers of gold jewelry (Saudi gold, Japan gold, Italian gold, Hong Kong gold, 18K/21K/22K/24K), pawn-savvy buyers, investors in bars/coins, Luxx4less resellers, and people who want to sell old gold.

---

## 4. Brand assets (photos, logo)

Facebook blocks automated downloads, so the owner will manually save photos into `/brand-assets`:

```
/brand-assets
  /logo          -> profile picture + any logo files
  /cover         -> Facebook cover photos
  /products      -> product photos (rings, necklaces, bracelets, earrings, bars)
  /store         -> shop, team, packaging, live-selling photos
  /testimonials  -> customer screenshots (only with customer permission)
```

Your tasks:
- Write `scripts/process-images.ts` using `sharp`: auto-orient, strip EXIF/GPS metadata, resize to responsive sizes, export AVIF + WebP, generate blur placeholders, and output a typed manifest `src/content/images.ts`.
- If a folder is empty, use tasteful neutral placeholders and list the missing shots in `TODO.md`. Never use random stock photos of other brands' jewelry.
- **Logo:** recreate the existing logo as a clean SVG if it's usable. Also design a new **"LV" monogram mark** (for favicon, app icon, loading state, watermark on listing photos) that respects the registered black-and-gold mark. Show me 3 monogram options at Checkpoint 1.
- Watermark every marketplace listing photo with a subtle monogram + listing ID to deter photo theft (a very common scam in PH jewelry selling).

---

## 5. Design direction (must be unique — not a copy of the reference)

### Concept: "The Vault at Night"
A private jeweler's vault after hours: deep aubergine-black velvet, warm champagne gold, and the cold white sparkle of diamonds. The reference is flat near-black; we go warmer, richer, more tactile.

### Color tokens (Tailwind CSS variables, with light + dark modes)
| Token | Hex | Use |
|---|---|---|
| `velvet` | #17101F | Primary dark background (aubergine-black, not flat black) |
| `velvet-raised` | #221830 | Raised surfaces in dark mode |
| `champagne` | #D6B26E | Primary gold accent, prices, key CTAs |
| `bullion` | #A8823F | Pressed/hover gold, gold on light backgrounds (passes contrast) |
| `pearl` | #EEF0F3 | Light-mode background (cool pearl, **not** cream) |
| `ice` | #BFD8E4 | Diamond accent: verification badges, focus rings, sparkles |
| `ink` | #1C1A22 | Body text on light |
| Semantic | success #3E9B6E · warning #D89A2B · danger #C2453D | Status only |

- Storefront product pages default to **pearl light mode** (jewelry photographs better on light); marketing/hero/market pages lean dark velvet. Include a theme toggle; respect system preference.
- Gold is a real gradient only on the signature elements (logo, live price hero, primary CTA). Everywhere else it's a flat color. No gradient washes as decoration.
- All text meets WCAG AA contrast. Test champagne-on-pearl — use `bullion` instead where needed.

### Typography (Google Fonts via `next/font`, self-hosted)
- **Display:** Bodoni Moda (high-contrast luxury serif) — headings, prices in the hero, product names
- **Body/UI:** Plus Jakarta Sans — everything else; use tabular figures (`font-variant-numeric: tabular-nums`) for all prices and tables. No monospace fonts for data.
- Type scale based on a 1.25 ratio; body 16–18px, line length ≤ 75 characters; serif headings with generous tracking at large sizes.
- Sentence case everywhere. No ALL-CAPS eyebrow labels above headings, no "→" appended to every link.

### Signature moment (spend the boldness here)
**"The Living Gram" hero:** the current ₱ per gram of 24K gold rendered huge in Bodoni Moda with a slow molten-gold shimmer inside the numerals, updating live with a subtle roll animation when the price ticks. Behind it, a 3D gold bar (react-three-fiber, low-poly + PBR material, HDRI reflections) that rotates as you scroll and then "slides" down into the featured products grid. Karat chips (24K / 22K / 21K / 18K / 14K) under the number instantly switch the displayed per-gram price.
- Fallback: a pre-rendered video/WebP sequence on low-end devices; a static image when `prefers-reduced-motion` is on.

### Motion system (purposeful, not everywhere)
- **Lenis** smooth scroll + **GSAP ScrollTrigger** for scroll-linked scenes; **Motion (Framer Motion)** for UI state transitions.
- Scroll scenes: hero bar rotation; a pinned "How verification works" section where each step lights up as you scroll; a horizontal-scroll collection gallery; parallax on brand/store photos; count-up for trust numbers (since 2019, followers, completed trades).
- Micro-interactions: magnetic primary buttons, a soft gold spotlight that follows the cursor on product cards (desktop only), a diamond "sparkle" on successful verification, wishlist heart burst, price ticker marquee in the header.
- Page transitions: short crossfade + slight scale (≤ 300ms).
- Rules: one orchestrated entrance per page, not fade-up on every section. All motion disabled or reduced under `prefers-reduced-motion`. Animations must not block interaction or cause layout shift. Keep 60fps on a mid-range Android phone.

### Layout
- Mobile-first (most PH buyers shop on phones). Sticky bottom nav on mobile: Home, Shop, Prices, Sell, Account.
- 12-column grid on desktop, generous whitespace, left-aligned text blocks, centered only in the hero.
- Vary card treatments by hierarchy (flagship Luxx4less items get larger, editorial cards; marketplace listings get compact cards). Not one identical rounded card for everything.

### Voice
Plain, warm, confident. English primary with natural Taglish in headlines and helper text. Include full **English / Filipino** i18n (next-intl), language toggle in header.

⛔ CHECKPOINT 1: show me a design board page (`/design-system`) with tokens, type scale, buttons, cards, badges, 3 monogram options, and the hero prototype.

---

## 6. Tech stack

- **Next.js (latest stable, App Router) + TypeScript (strict)**, React Server Components by default
- **Tailwind CSS + shadcn/ui** (restyled to our tokens — must not look like default shadcn)
- **PostgreSQL** (Neon or Supabase) + **Prisma**
- **Better Auth** (email/password, email verification, TOTP 2FA, passkeys, session/device management)
- **Resend + React Email** for all transactional email (branded templates)
- **Cloudflare R2 or S3**: a public bucket for listing images, and a separate **private, encrypted bucket for KYC documents** (never publicly accessible; short-lived signed URLs for admins only)
- **Upstash Redis** for rate limiting, caching price data, and OTP throttling
- **Realtime chat:** Ably or Pusher Channels
- **Charts:** Recharts or lightweight-charts for price history
- **Validation:** Zod on every input, client and server
- **Monitoring:** Sentry + structured logging
- **Testing:** Vitest (unit), Playwright (E2E)
- Deploy target: Vercel. PWA installable (manifest, icons, offline price cache page).

---

## 7. Site map (routes)

Public:
- `/` Home — Living Gram hero, live ticker, featured Luxx4less collections, "Sell your gold" CTA, how verification works, trust wall (since 2019, reviews, live-selling schedule), Instagram/FB photo strip, FAQ teaser
- `/shop` Official Luxx4less store — filter by category (rings, necklaces, bracelets, earrings, pendants, bangles, bars/coins, diamonds), karat, gold type (Saudi, Japan, Italian, HK), weight range, price range, pawnable yes/no; sort; infinite scroll with URL-synced filters
- `/shop/[slug]` Product page — zoomable gallery, 360° spin if available, karat, exact weight in grams, live price breakdown (weight × karat purity × spot + workmanship), certificate/receipt info, pawnable badge, layaway ("hulugan") option, add to cart/wishlist, share, related items
- `/marketplace` Verified P2P listings (buy and sell posts) with same filters + seller trust score, location (region/province/city), verification tier badge
- `/marketplace/[id]` Listing detail — seller profile card, verification badges, item details, test/certificate uploads, "Make an offer", "Chat with seller" (verified users only)
- `/prices` Market data — live gold/silver/platinum/palladium ₱/g, per karat, USD/oz, USD/PHP, 24h change, charts (1D/1W/1M/1Y/5Y), karat conversion table, troy oz ↔ gram ↔ tael converter, sources + timestamp
- `/tools` Gold value calculator, scrap gold calculator, ring size guide, diamond 4Cs explainer, price alert setup
- `/sell` Sell your gold to Luxx4less — instant estimate from calculator → request quote → book appraisal (Antipolo or scheduled)
- `/learn` Education hub (MDX articles): spotting fake gold, how gold is tested, karat guide, Saudi vs Japan vs Italian gold, diamond basics, how to trade safely, scam red flags
- `/live` Live-selling schedule + embedded replays + "notify me"
- `/resellers` Reseller program page + application form
- `/sellers/[handle]` Public seller profile (ratings from completed trades only)
- `/trust` Trust & safety center: how verification works, escrow flow, report a scam, list of official Luxx4less contact channels ("we will never message you from other numbers")
- `/about`, `/contact`, `/faq`
- Legal: `/terms`, `/privacy`, `/kyc-policy`, `/prohibited-items`, `/refund-policy`, `/cookies`

Auth: `/sign-up`, `/sign-in`, `/verify-email`, `/forgot-password`, `/verify` (KYC wizard)

Account: `/account` dashboard, orders, offers, messages, listings, wishlist, price alerts, verification status, security (2FA, passkeys, devices, sessions), payout details, data export/delete request

Admin (`/admin`, role-gated + 2FA required): KYC review queue, users, listings moderation, orders, disputes, reports, price overrides/spreads, content (products, collections, articles, banners), live schedule, resellers, audit log, analytics

---

## 8. Registration and multi-layer verification (the security core)

Implement **verification tiers**. Show the user's tier as a badge everywhere their name appears.

| Tier | Requirements | Unlocks |
|---|---|---|
| Guest | none | Browse, prices, tools, learn |
| Tier 1 — Email verified | Sign up → verification email with a single-use, 24h-expiry token link → click to confirm | Wishlist, price alerts, cart for official store |
| Tier 2 — Phone verified | PH mobile (+63 9XX) OTP via SMS (Semaphore or Twilio adapter), 6-digit, 5-min expiry, max 5 attempts, rate limited | Checkout from official store (small amounts), messaging |
| Tier 3 — Identity verified (required for ALL P2P buyers and sellers) | Valid PH government ID (front + back) + selfie **liveness check** + **face match** against ID photo | Marketplace buying, offers, chat with sellers |
| Tier 4 — Verified seller | Tier 3 + proof of address (≤ 3 months old) + for businesses: DTI/SEC registration and BIR COR + payout account in the same name as the ID | Create listings, receive payouts |

### Accepted Philippine IDs (configurable list in `src/config/kyc.ts`)
PhilSys National ID (PhilID card or ePhilID), Passport (DFA), Driver's License (LTO), UMID, SSS ID, PRC ID, Postal ID (PHLPost), PhilHealth ID, Senior Citizen ID, PWD ID, Voter's ID/Certification, TIN ID, OFW/OWWA ID, school ID (minors not allowed — enforce 18+).

### KYC implementation
- Build a `KycProvider` interface with adapters for a real vendor that supports PH IDs, liveness, and face match (e.g., Sumsub, Veriff, Persona, or AWS Rekognition Face Liveness + Textract). Default to a **MockKycProvider** in dev. Do **not** hand-roll face recognition.
- For PhilSys IDs, also validate the ID's QR code against the official PhilSys verification method where technically feasible `[CONFIRM availability/terms]`.
- Wizard UX (`/verify`): 1) choose ID type → 2) capture front/back with on-screen frame guide, glare/blur detection, auto-capture → 3) selfie liveness (look left/right, blink, as the vendor requires) → 4) review & consent → 5) status page (Pending / Approved / Needs resubmission / Rejected, with a clear reason). Works on mobile camera and desktop webcam, with an upload fallback.
- Checks: name on ID = account name; DOB → age ≥ 18; ID not expired; duplicate-ID and duplicate-face detection across accounts (block multi-accounting); sanctions/PEP screening via vendor if available.
- Anything uncertain goes to the **admin manual review queue**; admins see side-by-side ID vs selfie, vendor scores, and must record a reason for every decision (logged in the audit log).
- Re-verification triggers: new device + high-value transaction, payout account change, name change, 12-month expiry.
- Display ID numbers only masked (e.g., `••••-••••-1234`) anywhere, including admin lists.

---

## 9. Transactions, payments, and anti-scam flow

### Official store (Luxx4less)
Cart → checkout → pay → order tracking (Pending payment → Paid → Packed → Shipped → Delivered → Completed). Payment via **PayMongo or Xendit** adapter (GCash, Maya, cards, online banking, QR Ph). Also support "Bank transfer with proof upload" as a manual option that admin confirms. Layaway plan: configurable down payment % and installment schedule with reminders; item reserved until fully paid.

### P2P marketplace
1. Buyer makes an offer or accepts price → seller confirms → **order locks the listing**.
2. Buyer pays into a **protected payment hold** via the payment provider (funds released to the seller only after the buyer confirms receipt, or automatically after N days with no dispute). `[CONFIRM with lawyer: holding funds for others may require BSP licensing — use the payment provider's marketplace/split-payment features rather than holding funds ourselves.]`
3. Shipping with tracking number (LBC, J&T, Lalamove, etc.) or **meet-up at a safe location** (optional "meet at Luxx4less Antipolo for in-person testing" add-on).
4. Buyer confirms item received and matches description → funds released → both sides leave reviews.
5. Dispute button available until release: evidence upload (photos, test results, videos), admin mediation, outcome logged.

### Anti-scam protections
- In-app chat only for verified users; automatically detect and warn when someone shares phone numbers, external bank accounts, or "pay outside the platform" phrases, with a banner explaining the risk.
- Trust score per user: verification tier, completed trades, dispute rate, account age, response time.
- Report user/listing button everywhere; auto-hide listings after N reports pending review.
- Price sanity check: listings priced far below current melt value get a "Verify before buying" warning (a top red flag per the reference's own FAQ).
- Listing photo watermarking + reverse-duplicate detection (perceptual hash) to catch stolen photos.
- Cooling-off: brand-new sellers have limits on number and value of listings until they complete X trades.

---

## 10. Live prices engine

- Server-side fetcher (cron every 60s, cached in Redis) pulling spot XAU, XAG, XPT, XPD in USD/oz and USD/PHP from at least two sources with automatic failover (the reference uses gold-api.com and open.er-api.com; add a second source for each). Never call price APIs from the browser.
- Compute ₱/gram = (USD/oz × USD/PHP) ÷ 31.1035, then per karat by purity: 24K 0.999, 22K 0.916, 21K 0.875, 18K 0.750, 14K 0.585, 10K 0.417.
- Admin-configurable **Luxx4less buy/sell spreads** per karat and per product type so the store shows "We buy at" and "We sell at" prices (their live-selling posts price jewelry per gram, e.g., ₱7,700–7,800/g, so per-gram pricing is central).
- Store price snapshots for history charts. Show last-updated time and source; if data is stale (> 10 min), show a clear "Prices delayed" state instead of wrong numbers.
- Price alerts: user sets target → email/push when crossed.

---

## 11. Security requirements (non-negotiable)

- OWASP Top 10 covered; security headers (strict CSP with nonces, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy allowing camera only on `/verify`)
- Passwords hashed with Argon2id; breached-password check (HIBP k-anonymity); 2FA required for sellers and all admins
- Rate limiting on auth, OTP, KYC, chat, offers, and search; bot protection (Cloudflare Turnstile) on sign-up, sign-in, and contact forms
- Session security: httpOnly, secure, SameSite cookies; device list with remote sign-out; new-device and new-location email alerts
- Role-based access control (buyer, seller, reseller, support, kyc_reviewer, admin, super_admin) enforced server-side on every action — never trust the client
- KYC files: private bucket, encrypted at rest, signed URLs ≤ 5 minutes, every view logged, automatic deletion per retention policy
- Field-level encryption for ID numbers, DOB, addresses, payout accounts
- Immutable audit log for admin and money-related actions
- File uploads: type/size validation, magic-byte check, image re-encoding, malware scan hook
- Dependency scanning and secret scanning in CI

---

## 12. Philippine legal and compliance checklist

Build the product so these are supported, and list each in `COMPLIANCE.md` with status. I (the owner) will confirm with a lawyer — Claude Code is not giving legal advice.
- **Data Privacy Act of 2012 (RA 10173):** ID images and biometric/face data are sensitive personal information → explicit, separate consent screens, privacy notice, Data Protection Officer contact, data subject rights (access, correction, deletion, export), breach-response runbook, NPC registration if applicable.
- **Anti-Money Laundering Act (as amended):** dealers in precious metals and stones are covered persons for large cash transactions → support customer due diligence, record keeping (5 years), and flagging/reporting workflows for transactions above the AMLC threshold `[CONFIRM current threshold and obligations]`.
- **Internet Transactions Act of 2023 (RA 11967):** e-marketplace duties such as verifying and displaying seller information and handling complaints `[CONFIRM DTI E-Commerce Bureau registration]`.
- **Consumer Act / DTI** rules for pricing, returns, and warranties; BIR-compliant invoicing for official store sales.
- Age gate: 18+ only.
- Cookie consent banner with granular choices.

---

## 13. Data model (starting point — refine in Phase 2)

User, Account, Session, Device, Role, VerificationTier, KycSubmission (docs refs, vendor result, reviewer, decision, reason), PhoneOtp, Address, PayoutAccount, SellerProfile, ResellerApplication, Product (official store), Collection, Listing (P2P), ListingImage (hash, watermark), Offer, Order, OrderItem, Payment, PaymentHold, Shipment, Dispute, DisputeEvidence, Review, Conversation, Message, Report, PriceSnapshot, PriceAlert, Spread, LayawayPlan, Installment, Article, LiveEvent, Notification, AuditLog, ConsentRecord.

---

## 14. Performance, SEO, accessibility

- Lighthouse (mobile) ≥ 90 on Performance, Accessibility, Best Practices, SEO for home, shop, product, and prices pages. LCP < 2.5s on 4G, CLS < 0.1.
- 3D/GSAP loaded lazily and only where used; images via `next/image` with AVIF/WebP and blur placeholders.
- SEO: per-page metadata, dynamic OG images (product photo + live price), `sitemap.xml`, `robots.txt`, JSON-LD (Organization, LocalBusiness, Product with Offer, FAQPage, BreadcrumbList), canonical URLs, hreflang for EN/FIL. Target searches like "gold price per gram Philippines today", "Saudi gold price", "legit gold seller Antipolo".
- Accessibility: WCAG 2.2 AA, full keyboard navigation, visible focus (ice-blue ring), alt text on every image, form errors announced to screen readers, KYC wizard usable with screen readers where the vendor allows.

---

## 15. Extra features I want (add if not in the reference)

- Gold value calculator + "Sell to us" instant estimate
- Price alerts (email + web push)
- Layaway / hulugan plans
- Pawnable and certificate badges; digital authenticity certificate with QR per Luxx4less item (scan → verify page on our domain)
- Live-selling schedule and replays
- Reseller portal (wholesale pricing tiers visible only to approved resellers)
- Wishlist, recently viewed, compare up to 3 items
- Appointment booking for appraisal/in-person testing
- Messenger/Viber/WhatsApp contact buttons that only link to **official** numbers from brand config
- Admin analytics: sales, top products, conversion funnel, KYC approval rates, dispute rates

---

## 16. Build phases and checkpoints

| Phase | Scope | Checkpoint |
|---|---|---|
| 0 | Reference audit (section 2) | ⛔ Review AUDIT.md + PARITY.md |
| 1 | Project setup, design system, brand assets pipeline, monogram options, hero prototype | ⛔ Approve look & feel |
| 2 | Database schema, auth (email verification, 2FA, passkeys), roles, email templates | ⛔ Demo sign-up → verify email → sign in |
| 3 | Price engine, `/prices`, `/tools`, home page | ⛔ Live prices working with failover |
| 4 | Official store: catalog, product pages, cart, checkout (payment adapter in test mode), orders, layaway | ⛔ Full test purchase |
| 5 | KYC tiers + verification wizard + admin review queue (mock + one real vendor adapter) | ⛔ Demo all tiers end to end |
| 6 | P2P marketplace: listings, offers, chat, payment hold flow, shipping, reviews, disputes, anti-scam | ⛔ Full buyer↔seller test trade |
| 7 | Learn hub, live page, resellers, sell-to-us, trust center, legal pages, i18n | ⛔ Content review |
| 8 | Admin dashboard completion, analytics, audit log | ⛔ Admin walkthrough |
| 9 | Motion polish, performance, SEO, accessibility audit, security review, E2E tests | ⛔ Lighthouse + test reports |
| 10 | Deployment guide (`DEPLOY.md`), env setup, seed data, owner handbook (`OWNER_GUIDE.md` in plain language) | ⛔ Launch readiness |

---

## 17. Definition of done

- Every row in `PARITY.md` checked off
- All Playwright E2E flows pass: sign-up → email verify → phone OTP → KYC (mock) → buy from store → list item as seller → P2P trade → dispute → admin resolves
- No TypeScript errors, no ESLint errors, no console errors
- Mobile (390px), tablet, and desktop screenshots reviewed for every page
- Reduced-motion mode verified
- No secrets in repo; `.env.example` complete
- `OWNER_GUIDE.md` explains in simple English/Taglish how to add products, update spreads, review KYC, handle disputes, and schedule lives

Begin with Phase 0 now.
