# Reference audit — metalmarketph.com

Status: **provisional.** The rendered crawl hasn't run yet. This build environment's network policy blocks `www.metalmarketph.com`, so the crawler can't reach it from here (see "How to finish this audit" below). This first pass uses only what can be confirmed without rendering the site:

- **V (verified):** seen in search-engine results for the site's own pages (titles, meta descriptions, indexed text).
- **B (brief):** stated in the owner's brief (`PROMPT.md` §2). Not yet checked against the live site.
- **I (inferred):** the site's category implies it is probably there, but it isn't confirmed. Treat as a question.

We match the reference site's features, not its code, copy, images or layout. Quotes and paraphrases below are for internal analysis only. None of them go into Luxx Vault copy.

---

## 1. Sitemap

| Route | What it is | Evidence |
|---|---|---|
| `/` | Landing: positioning as a P2P marketplace for gold, silver, precious metals and gemstones | V (site title "Metal Market PH — Buy & Sell Gold, Silver & Precious Gems") |
| `/market-data` | Live prices page ("Market Data — Live Gold & Silver Prices Philippines") | V (indexed URL) |
| Marketplace / listings | Browse buy and sell posts | B + I (route name unknown) |
| Education / FAQ | Red flags, how professionals test gold | V (red-flag text indexed) + B |
| Sign-up / sign-in / verification | "Verified buyers" implies account plus some verification | I (flow and depth unknown) |
| Karat conversion tables | May live on `/market-data` or a separate route | B |

The crawler checks 30 common route guesses as well as every link it finds, so the real sitemap will replace this table.

## 2. Feature inventory

### Prices and market data (`/market-data`)
- Spot for gold (XAU), silver (XAG) and platinum (XPT) in ₱ per gram, plus USD per troy ounce. **B**
- USD/PHP exchange rate shown. **B**
- Explains that PH prices follow the international spot price (LBMA/COMEX) converted at the current USD/PHP rate. **V**
- Troy ounce ↔ gram conversion note. **B**
- Last-updated timestamp and links to sources. **B**
- Sources: gold-api.com (spot) and open.er-api.com (FX), cross-checked against GoldPrice.org's Philippines page. **V** (GoldPrice.org cross-reference) / **B** (the two APIs)
- Karat conversion table (purity → ₱/g). **B**
- Unknown until crawled: whether there are charts or history, which timeframes, palladium, 24h change, per-karat buy/sell, refresh interval, and stale-data handling.

### Marketplace
- P2P listings for gold, silver, precious metals and gemstones. **V**
- "Verified buyers" and "secure transactions" claims. **V**
- Unknown until crawled: listing fields, filters and sort, seller profiles, ratings, offers, chat, how payment actually works (escrow or off-platform), dispute handling, and how deep the verification goes. **I**

### Education and FAQ
- Red flags when buying gold. Their list (paraphrased): price far below market, seller won't allow testing, discolouration or marks, feels too light for its size, no hallmark stamp, seller has no verifiable address or reviews. **V**
- How professionals test gold: XRF analysers, acid kits, electronic testers, loupes, precision scales, diamond testers. **B**

### Look and feel
- Dark theme, near-black `#0b0b0f`. **B**
- Client-rendered React SPA. Raw HTML contains only meta tags. **B** (consistent with search results showing only meta-level text)

### Auth
- Unknown. The crawler records every form field, label and required flag on any auth route it finds.

## 3. UX strengths worth matching

1. **One clear promise.** P2P marketplace, live prices, verified people, safe trades. Easy to understand in one line.
2. **The price explanation is educational.** Saying spot is LBMA/COMEX converted at the live FX rate builds trust. We keep that transparency and go further, with the exact formula and per-karat purity shown.
3. **Sources are cited.** Naming the API sources and a cross-check is a credibility signal. We'll show source and timestamp on every price.
4. **Anti-scam education is up front.** The red-flag list is the right instinct for the PH market.

## 4. Weaknesses we will beat

These are expected, based on the architecture. The crawl will confirm or drop each one.

| Area | Likely gap | Luxx Vault answer |
|---|---|---|
| Performance / SEO | A client-rendered SPA ships empty HTML. Slower first paint on 4G, and search engines index only meta tags (search results already show mostly meta-level text). | Server-rendered Next.js pages, per-page metadata, JSON-LD, dynamic OG images with the live price. Target: Lighthouse mobile ≥ 90. |
| Trust signals | "Verified" isn't defined publicly. | Published tier system (email → phone → ID + liveness → verified seller), badge on every name, a `/trust` centre, and official contact channels listed. |
| Transaction safety | Probably relies on off-platform payment. | Payment hold through a licensed provider's marketplace features, release on receipt, disputes, anti-scam chat detection, and a melt-value sanity warning. |
| Pricing depth | Spot only. No dealer buy/sell spread. | "We buy at / we sell at" per karat from admin-set spreads, stale-data state, history charts from 1D to 5Y, price alerts. |
| Local fit | Generic P2P. | Saudi / Japan / Italian / HK gold types, pawnable badge, hulugan layaway, tael converter, Taglish copy, an official flagship store from a brand operating since 2019. |
| Accessibility | Dark-only theme. Contrast and landmarks not yet checked. | WCAG 2.2 AA, light and dark themes, ice-blue focus ring, reduced-motion support. The crawler logs missing alt text, unlabelled inputs, heading skips and landmarks per page. |
| Mobile | Not yet checked. | Mobile-first with a sticky bottom nav. |

## 5. Data sources

| Purpose | Reference uses | Luxx Vault plan |
|---|---|---|
| Metal spot (USD/oz) | gold-api.com **B** | gold-api.com as primary, plus a second provider for failover (picked in Phase 3). Fetched server-side only and cached in Redis. |
| USD/PHP | open.er-api.com **B** | open.er-api.com as primary, plus a second FX source for failover. |
| Cross-check | GoldPrice.org PH **V** | Automatic sanity check: if the two sources differ by more than a set tolerance, show the "Prices delayed" state instead of a wrong number. |

The crawler records every external host and every fetch/XHR endpoint on each page, so this table can be confirmed exactly.

---

## How to finish this audit

On your own computer, in `C:\CLIENT FILES\LUXXE4LESS\luxx-vault`:

```powershell
npm install
npx playwright install chromium
npm run audit:reference
```

The crawler honours robots.txt, waits at least 1 second between page loads, and writes:

- `audit/screenshots/<route>-1440.png` and `<route>-390.png`
- `audit/data/<route>.json`: headings, buttons, links, forms, tables, data requests, accessibility gaps
- `audit/crawl-summary.json` and `audit/AUDIT-RAW.md`

Commit those files, or give the session network access to `www.metalmarketph.com` and it runs here. Then every **B** and **I** above becomes **V**, or gets removed, and PARITY.md gets its final rows.

## Sources

- [Metal Market PH — Market Data (search index)](https://www.metalmarketph.com/market-data)
- [GoldPrice.org — Philippines](https://goldprice.org/gold-price-philipines.html)
