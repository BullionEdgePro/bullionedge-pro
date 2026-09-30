# Parity checklist — reference → Luxx Vault

Every row must be checked off before launch. Evidence: **V** verified, **B** from the brief, **I** inferred (see AUDIT.md). Rows marked **I** stay until the crawl confirms or removes them. New rows from the crawl go at the bottom under "Added after crawl".

| # | Reference feature | Ev. | Our equivalent | Our upgrade | Phase | Done |
|---|---|---|---|---|---|---|
| P1 | Gold (XAU) ₱/gram | B | `/prices`, home hero, header ticker | "Living Gram" hero with per-karat chips; a price roll animation on each tick | 3 | [ ] |
| P2 | Silver (XAG) ₱/gram | B | `/prices` | Same as P1 plus 24h change | 3 | [ ] |
| P3 | Platinum (XPT) ₱/gram | B | `/prices` | Same as P1 plus 24h change | 3 | [ ] |
| P4 | — (palladium not confirmed) | — | `/prices` XPD | Added metal | 3 | [ ] |
| P5 | USD/oz spot | B | `/prices` | Shown next to ₱/g, with the formula disclosed | 3 | [ ] |
| P6 | USD/PHP rate | B | `/prices`, ticker | Two FX sources with failover | 3 | [ ] |
| P7 | Troy-oz conversion note | B | `/prices` + `/tools` converter | Interactive troy oz ↔ gram ↔ tael converter | 3 | [ ] |
| P8 | Last-updated timestamp | B | Every price surface | Relative plus absolute time (Asia/Manila); a "Prices delayed" state after 10 min | 3 | [ ] |
| P9 | Source links | B | `/prices` footer | Source per metal and FX, with failover source named when active | 3 | [ ] |
| P10 | PH price = LBMA/COMEX spot × USD/PHP explanation | V | `/prices` explainer + `/learn` article | Exact formula and purity factors shown | 3 | [ ] |
| P11 | Cross-reference with GoldPrice.org PH | V | Automatic sanity check between sources | Tolerance check blocks wrong numbers | 3 | [ ] |
| P12 | Karat conversion table | B | `/prices` table (24K–10K) | Live ₱/g per karat plus Luxx4less "we buy / we sell" columns | 3 | [ ] |
| P13 | Price history / charts | I | `/prices` charts 1D/1W/1M/1Y/5Y | Snapshots stored in our DB | 3 | [ ] |
| P14 | P2P listings: gold | V | `/marketplace` | Tier-3-only buying, trust score, region filter | 6 | [ ] |
| P15 | P2P listings: silver | V | `/marketplace` | Same as P14 | 6 | [ ] |
| P16 | P2P listings: other precious metals | V | `/marketplace` | Same as P14 | 6 | [ ] |
| P17 | P2P listings: gemstones | V | `/marketplace` | Same as P14, plus certificate upload | 6 | [ ] |
| P18 | Listing detail page | I | `/marketplace/[id]` | Seller card, badges, test/cert uploads, watermarked photos, melt-value warning | 6 | [ ] |
| P19 | Listing filters / search | I | `/marketplace` filters | URL-synced filters: karat, gold type, weight, price, location, tier | 6 | [ ] |
| P20 | Create listing | I | `/account/listings/new` | Tier-4-only, cooling-off limits, photo hash duplicate check | 6 | [ ] |
| P21 | Contact / message seller | I | In-app chat | Verified-only, off-platform-payment detection banner | 6 | [ ] |
| P22 | "Verified buyers" | V | Tiers 1–4 with badges | ID + liveness + face match via KYC vendor; published tier rules | 5 | [ ] |
| P23 | "Secure transactions" | V | Payment hold via provider | Release on receipt, disputes, audit log | 6 | [ ] |
| P24 | Sign-up | I | `/sign-up` | Email verify, Turnstile, breached-password check | 2 | [ ] |
| P25 | Sign-in | I | `/sign-in` | TOTP 2FA, passkeys, device list | 2 | [ ] |
| P26 | User profile / dashboard | I | `/account`, `/sellers/[handle]` | Ratings from completed trades only | 2/6 | [ ] |
| P27 | Red flags when buying gold | V | `/learn/scam-red-flags` + `/trust` | Original copy; red flags built into product warnings (melt-value check, chat detection) | 7 | [ ] |
| P28 | How professionals test gold (XRF, acid, electronic, loupe, scale, diamond tester) | B | `/learn/how-gold-is-tested` | Book in-person testing at Luxx4less Antipolo | 7 | [ ] |
| P29 | FAQ | B | `/faq` | FAQPage JSON-LD, EN/FIL | 7 | [ ] |
| P30 | Dark theme | B | Theme toggle | Light "pearl" + dark "velvet", system preference; deliberately different look | 1 | [ ] |
| P31 | SEO meta title/description | V | Per-page metadata | SSR content, JSON-LD, OG images with live price, sitemap, hreflang | 9 | [ ] |

## Added after crawl

_(filled from `audit/AUDIT-RAW.md`)_
