# Reference audit — metalmarketph.com

Crawled 2026-09-30 with `scripts/audit-reference.ts`. The crawl honoured robots.txt (which disallows `/admin`, `/buyer-dashboard`, `/seller-dashboard` and `/reset-password`, none of which we touched) and spaced page loads at least 1 s apart. Screenshots at 1440px and 390px are in `audit/screenshots/`. Per-page inventories are in `audit/data/`, and the machine notes are in `audit/AUDIT-RAW.md`.

We match the reference site's features, not its code, copy, images or layout. The paraphrases below are for internal analysis only.

**Caveats on this crawl**
- `api.gold-api.com` was blocked by this environment's network policy during the crawl. The reference couldn't fetch spot prices, so the numbers in the screenshots (₱5,394/g, $2,680/oz) are its **fallback values, not live prices**. Layout and features are unaffected.
- A "Disclaimer and Data Privacy Notice" dialog blocks every first visit. The crawler clicked "I Agree" before capturing each page. See "Blocking dialog" in AUDIT-RAW.md.
- Scroll-reveal cards start invisible, so the crawler forced them visible for full-page screenshots. What you see is what a visitor sees after scrolling.
- We did not create accounts, so everything behind sign-in (dashboards, listing creation, messaging) is outside this audit.

---

## 1. Sitemap

| Route | Page | How found |
|---|---|---|
| `/` | Landing: hero, price chart, calculator, how it works | start |
| `/about` | Mission and founder story | nav + sitemap.xml |
| `/marketplace` | P2P marketplace (seller listings / buyer requests) | nav |
| `/market-data` | Live prices, karat table, FAQ | nav + sitemap.xml |
| `/install` | PWA install instructions | nav + sitemap.xml |
| `/login` | Sign in | nav + sitemap.xml |
| `/forgot-password` | Password reset request | link on `/login` |
| `/signup` | Choose buyer or seller | nav + sitemap.xml |
| `/signup/buyer` | Buyer registration | link on `/signup` |
| `/signup/seller` | Seller registration **plus the first listing** | link on `/signup` |
| `/privacy` | Privacy policy (19 sections) | footer |
| `/terms` | Terms and conditions (21 sections) | footer |
| `/buyer-dashboard`, `/seller-dashboard`, `/admin`, `/reset-password` | Exist per robots.txt; behind auth | robots.txt (not visited) |
| `/#calculator`, `/#how-it-works` | Home-page sections linked from the nav | nav |

22 other common route names (`/faq`, `/contact`, `/prices`, `/learn`, `/verify`…) all render the site's not-found page. **There is no FAQ page, contact page, education hub or verification flow.**

## 2. Feature inventory

### Global
- Header nav: About, Calculator, Marketplace, How it works, Market data, Install app, Log in, Sign up. Mobile uses a hamburger menu.
- A disclaimer and data-privacy dialog shows on first visit, with "Read terms and privacy policy" and "I agree" buttons. Its key message: the platform is a communication tool only. It does not buy, sell, broker, inspect, verify, guarantee, process payments, provide escrow or arrange delivery. All deals and disputes are between the users.
- Footer: logo, About, Market data, Install app, Privacy, Terms, copyright.
- Installable PWA, with a dedicated `/install` page.
- Dark theme only (near-black background, gold accents, serif display headings).

### Home `/`
- Hero: "Buy & sell gold, silver & precious gems"; CTAs "I'm a Buyer" / "I'm a Seller"; three trust chips (verified buyers only, secure messaging, daily market updates).
- Metal switcher cards for gold, silver and platinum: ₱/g plus 30-day % change.
- 30-day area chart of gold ₱/g, labelled "Source: gold-api.com · Updated live".
- "Gold price performance" table: change in ₱ and % for Today, 30 days, 6 months, 1 year, 5 years and 20 years. Reference: goldprice.org, with the USD/PHP rate shown.
- **Precious metals calculator:**
  - Metal: gold, silver or platinum.
  - Karat: 24K, 22K, 21K, 20K, 18K, 14K, 10K, 9K or 6K.
  - **Specific-gravity ("SP") mode:** about 30 SG readings from 11.1 to 12.7, each mapped to a purity %.
  - Weight, with a unit of grams, troy ounces, kilos or tola.
  - Shows the current spot with a last-updated time and a "for reference only" note.
- "How it works" in three steps: create account → browse or post offers → connect and transact.

### Market data `/market-data`
- Live price cards for gold (XAU), silver (XAG) and platinum (XPT): ₱/g plus USD/oz spot.
- Updated time, a manual refresh button, and a link to GoldPrice.org (PH).
- A footnote giving USD/PHP, 1 troy oz = 31.1035 g, and the sources gold-api.com and open.er-api.com.
- Karat conversion table for 24K–9K: purity %, parts out of 24, live ₱/g. The note says dealer prices may vary.
- FAQ accordion: how to check purity, what a karat is, red flags when buying gold, tools professional buyers use, and how the PH gold price is determined.

### Marketplace `/marketplace`
- Live spot ticker strip (₱/g for gold, silver and platinum, plus updated time).
- Two modes: **Seller listings** (asks) and **Buyer requests** (bids / want-to-buy), with a "Post a request" CTA.
- Search box covering listings, metals, karat and sellers.
- Quick metal chips: gold, silver, platinum, palladium, plus a Filters button.
- Category tabs: gold, silver, platinum, diamonds, gemstones, coins and bullion.
- Currency selector (₱ PHP) and sort ("Recently posted").
- "Market stats" panel per metal, with purity and form filters, active asks and bids counts, and a note that expired and stale listings are excluded.
- Premium or discount calculated against the current ₱/g spot. Spot refreshes every 60 s.
- Trust lines: secure messaging with ID-verified peers, in-app messaging only with no addresses shared, ID-checked counterparties only.
- Empty state: "No listings for gold yet" with a "Post a request" CTA. The market was empty at crawl time.

### Sign-up
- `/signup`: choose buyer or seller. "Free for the first 100 users", which suggests paid plans later.
- `/signup/buyer` fields:
  - full name, username, email, and a password with a live checklist (10+ characters, upper, lower, number, symbol);
  - PH mobile (+63) and region → city (all 17 regions);
  - **specialisations** (gold assaying, diamond grading, gemstone ID, silver testing, antique jewellery, coins and bullion);
  - **tools used** (XRF, acid kit, electronic tester, loupe/microscope, GIA certification, diamond tester, spectrometer, custom);
  - years of experience, optional business name, and a marketing-consent checkbox.
  - The "buyer" is really modelled as a professional buyer or dealer.
- `/signup/seller`:
  - name, email, password, mobile, region and city;
  - **the first listing inline**: product type, item type, karat or purity (including .999, .925 and .900 silver), weight in grams, asking price in ₱, an "open for offers" toggle and a description;
  - an owner-of-items declaration.
- **No ID upload, selfie, liveness check or OTP step appears anywhere in sign-up.**

### Sign-in
- `/login`: email and password, a show-password toggle, and a forgot-password link. No 2FA, passkey or social login is visible.
- `/forgot-password`: an email field and "Send reset link".

### About / legal
- `/about`: origin story, values (transparency, legitimacy, accessibility), and a founder bio.
- `/privacy` (19 sections, including Data Privacy Act rights) and `/terms` (21 sections: platform role, prohibited activities, disputes between users, governing law).

## 3. Data sources and stack

| What | Source (observed network calls) |
|---|---|
| Spot XAU / XAG / XPT (USD/oz) | `GET api.gold-api.com/price/{XAU,XAG,XPT}`, **called from the browser** |
| USD/PHP | `GET open.er-api.com/v6/latest/USD`, called from the browser |
| Cross-check reference | GoldPrice.org PH (link and label only, no API call) |
| Listings / requests | Supabase REST (`seller_listings`, `buyer_offers`), read directly from the browser |
| Fonts | Google Fonts |
| Frontend | Client-rendered React SPA with Tailwind-style utility classes and Framer-Motion-style reveals |

## 4. UX strengths worth matching

1. **Asks and bids together.** Seller listings plus buyer requests, with market stats for active asks and bids, makes the marketplace feel like a market rather than a classifieds board.
2. **Premium versus spot on every listing.** Showing how far a listing sits above or below spot is very useful. We'll keep it and combine it with our "verify before buying" warning for listings far below melt value.
3. **Specific-gravity purity mode.** A genuinely local, practical tool: PH buyers test with SG. We'll offer it too, with the formula explained.
4. **Tola unit and 20K / 9K / 6K karats.** These match real PH and South Asian trade.
5. **Performance table from Today to 20 years.** A simple, persuasive investment view.
6. **Region → city picker** covering all 17 regions.
7. **Live password checklist** during sign-up.
8. **Installable PWA** with its own install page.

## 5. Weaknesses we will beat

| Area | What we observed | Luxx4less answer |
|---|---|---|
| **"Verified" isn't real** | Hero and marketplace claim "verified buyers" and "ID-checked counterparties", but sign-up collects no ID, selfie or OTP, and the disclaimer says the platform does not verify anyone. | Published tiers (email → phone OTP → ID + liveness + face match → verified seller), a tier badge beside every name, and ID checks by a KYC vendor. |
| **No transaction protection** | Disclaimer: no payment processing, no escrow, disputes left to the users. | Payment hold through a licensed provider's marketplace features, release on buyer confirmation, a dispute flow with evidence, and an audit log. |
| **Silent stale prices** | When the price API was unreachable, the site showed an old fallback price (≈ $2,680/oz) still labelled "Updated … live". | Server-side fetch with two sources per feed, a divergence check, and a clear "Prices delayed" state after 10 minutes. Never a wrong number shown as live. |
| **Price APIs called from the browser** | Every visitor hits gold-api.com and open.er-api.com directly. That's fragile (rate limits, blockers), and prices can differ between visitors. | Server-side fetch every 60 s, cached in Redis, one consistent price for everyone. |
| **SEO** | Client-rendered; login and all sign-up pages share the homepage `<title>`; no FAQ page, and FAQ content sits in a collapsed accordion. | Server-rendered pages, unique metadata, JSON-LD (FAQPage, Product, LocalBusiness), dynamic OG images, `/faq` and `/learn`. |
| **Accessibility** | 9–10 unlabelled inputs on each sign-up form (labels not tied to their fields), icon-only buttons without accessible names (refresh, show password), no `<main>` landmark on auth pages, and a heading skip on `/marketplace`. | WCAG 2.2 AA with properly labelled fields, named icon buttons, landmarks and a visible focus ring. |
| **First-visit friction** | A full-screen legal dialog blocks the hero on first load. | A short cookie-consent bar, with legal terms accepted at sign-up and checkout, not on arrival. |
| **Sign-up friction** | The seller must write a listing just to create an account. The buyer form asks for tools and years of experience. | Account first, listing later; progressive profile. |
| **No dealer pricing** | Only spot × purity; the note says "dealer prices may vary". | "We buy at / we sell at" per karat from Luxx4less spreads, a real store, appraisal booking. |
| **Thin education and support** | No `/faq`, `/learn`, `/contact` or trust centre. | Learn hub, trust and safety centre, official-contacts page, report-a-scam. |
| **Auth security** | Email and password only on the visible pages. | Email verification, TOTP 2FA, passkeys, device list, new-device alerts. |
| **Empty marketplace** | Cold-start: no listings at crawl time. | The Luxx4less official store gives day-one inventory, and the existing 722K-follower audience seeds the marketplace. |
| **Dark only** | No light theme. | Pearl light mode for product pages, velvet dark for market and hero pages, and a theme toggle. |
| **Localisation** | English only. | English / Filipino i18n with Taglish helper copy. |

## 6. Luxx4less-only extras (not in the reference)

Official flagship store, layaway (hulugan), pawnable badge, QR authenticity certificates, live-selling schedule, reseller portal, sell-your-gold instant quote and appraisal booking, price alerts, wishlist and compare, tael converter, palladium on `/prices`, and gold-type filters (Saudi, Japan, Italian, HK).
