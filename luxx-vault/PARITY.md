# Parity checklist — reference → Luxx Vault

Every row must be checked off before launch. Source: the 2026-09-30 crawl (see AUDIT.md). Routes refer to Luxx Vault.

## Global

| # | Reference feature | Our equivalent | Our upgrade | Phase | Done |
|---|---|---|---|---|---|
| G1 | Header nav (about, calculator, marketplace, how it works, market data, install, log in, sign up) | Header + mobile sticky bottom nav (Home, Shop, Prices, Sell, Account) | Live price ticker in header; EN/FIL toggle; theme toggle | 1 | [ ] |
| G2 | Mobile hamburger menu | Bottom nav + drawer | Thumb-reachable; keyboard and screen-reader tested | 1 | [ ] |
| G3 | First-visit disclaimer + privacy dialog | Cookie-consent bar with granular choices; terms accepted at sign-up and checkout | Doesn't block the first view | 7 | [ ] |
| G4 | Footer links (about, market data, install, privacy, terms) | Footer with all legal pages + official contact channels | "We will never message you from other numbers" notice | 7 | [ ] |
| G5 | Installable PWA | PWA manifest, icons, offline price-cache page | — | 9 | [ ] |
| G6 | `/install` instructions page | `/install` (or a section of `/about`) | Platform-detected instructions | 9 | [ ] |
| G7 | Dark theme | Velvet dark + pearl light | System preference; light mode for jewellery | 1 | [ ] |

## Prices and tools

| # | Reference feature | Our equivalent | Our upgrade | Phase | Done |
|---|---|---|---|---|---|
| P1 | Gold / silver / platinum ₱/g cards | `/prices`, home hero | Palladium added; "Living Gram" hero with karat chips | 3 | [ ] |
| P2 | USD/oz spot per metal | `/prices` | Formula disclosed | 3 | [ ] |
| P3 | USD/PHP rate shown | `/prices`, ticker | Two FX sources with failover | 3 | [ ] |
| P4 | 1 troy oz = 31.1035 g note | `/prices` + converter | Interactive troy oz ↔ g ↔ kg ↔ tola ↔ tael | 3 | [ ] |
| P5 | Updated time + manual refresh | Every price surface | "Prices delayed" state after 10 min; never a stale price labelled live | 3 | [ ] |
| P6 | Source credits (gold-api.com, open.er-api.com) | `/prices` footer | Names the active failover source | 3 | [ ] |
| P7 | GoldPrice.org PH cross-reference link | Automatic divergence check | Blocks wrong numbers | 3 | [ ] |
| P8 | Metal switcher with 30-day % change | `/prices` metal tabs | 24h change too | 3 | [ ] |
| P9 | 30-day ₱/g area chart | `/prices` chart | 1D / 1W / 1M / 1Y / 5Y from our own snapshots | 3 | [ ] |
| P10 | Performance table (today, 30d, 6m, 1y, 5y, 20y; ₱ and %) | `/prices` performance table | Per metal | 3 | [ ] |
| P11 | Karat table 24K–9K: purity %, parts/24, live ₱/g | `/prices` karat table | Adds 10K, 20K, 6K + Luxx4less "we buy / we sell" columns | 3 | [ ] |
| P12 | "Dealer prices may vary" note | Admin spreads per karat and product type | Actual dealer prices shown | 3 | [ ] |
| P13 | Calculator: metal, karat (24K–6K), weight, unit (g / oz / kg / tola) | `/tools` gold value calculator | Adds tael; "sell to us" instant estimate | 3 | [ ] |
| P14 | Specific-gravity (SP) purity mode | `/tools` calculator SG mode | Enter SG directly or pick a reading; method explained in `/learn` | 3 | [ ] |
| P15 | "For reference only" disclaimer on calculator | Same | — | 3 | [ ] |
| P16 | Market-data FAQ: checking purity, karats, red flags, testing tools, how PH price is set | `/learn` articles + `/faq` (FAQPage JSON-LD) | Full articles, EN/FIL, original copy | 7 | [ ] |

## Marketplace

| # | Reference feature | Our equivalent | Our upgrade | Phase | Done |
|---|---|---|---|---|---|
| M1 | Seller listings (asks) | `/marketplace` sell posts | Tier-4 sellers only; watermarked photos; photo-hash duplicate check | 6 | [ ] |
| M2 | Buyer requests (want-to-buy / bids) | `/marketplace` buy posts | Tier-3 buyers only | 6 | [ ] |
| M3 | "Post a request" CTA | Post buy request | — | 6 | [ ] |
| M4 | Search listings / metals / karat / sellers | Marketplace search | URL-synced | 6 | [ ] |
| M5 | Metal chips (gold, silver, platinum, palladium) | Filters | — | 6 | [ ] |
| M6 | Category tabs (gold, silver, platinum, diamonds, gemstones, coins and bullion) | Category filter | Adds Saudi / Japan / Italian / HK gold type | 6 | [ ] |
| M7 | Purity and form filters | Filters | Plus weight, price, region / province / city, tier | 6 | [ ] |
| M8 | Currency selector (₱ PHP) | ₱ primary | USD shown secondary | 6 | [ ] |
| M9 | Sort: recently posted | Sort | Plus price, premium vs spot, seller trust | 6 | [ ] |
| M10 | Market stats (active asks / bids count) | Market stats panel | Median premium per karat | 6 | [ ] |
| M11 | Listing expiry (stale listings excluded) | Listing expiry + renew | — | 6 | [ ] |
| M12 | Premium / discount vs live spot per listing | Same | "Verify before buying" warning when far below melt value | 6 | [ ] |
| M13 | Spot ticker on marketplace | Header ticker | — | 3 | [ ] |
| M14 | In-app messaging only, no addresses shared | Verified-only chat | Detects shared phone numbers, bank details and off-platform-payment wording | 6 | [ ] |
| M15 | "Open for offers" toggle | Make an offer flow | Offer → accept → listing locks | 6 | [ ] |
| M16 | Empty state with CTA | Same | Official Luxx4less store fills day-one inventory | 6 | [ ] |
| M17 | "Verified / ID-checked" claims (not backed at sign-up) | Tiers 1–4 with badges | Actually enforced: phone OTP, ID + liveness + face match | 5 | [ ] |
| M18 | Disclaimer: no payment handling, no escrow | Payment hold via licensed provider | Release on receipt, disputes, reviews | 6 | [ ] |
| M19 | Buyer dashboard (`/buyer-dashboard`, not audited) | `/account` | Orders, offers, messages, alerts | 6 | [ ] |
| M20 | Seller dashboard (`/seller-dashboard`, not audited) | `/account/listings` | Payouts, trust score | 6 | [ ] |

## Accounts

| # | Reference feature | Our equivalent | Our upgrade | Phase | Done |
|---|---|---|---|---|---|
| A1 | Choose buyer or seller at sign-up | One account; seller unlocked at Tier 4 | Less friction | 2 | [ ] |
| A2 | Name, username, email, password | `/sign-up` | Email verification link; Turnstile; breached-password check | 2 | [ ] |
| A3 | Live password checklist | Same | Labelled fields, announced to screen readers | 2 | [ ] |
| A4 | PH mobile (+63) field | Phone | OTP-verified (Tier 2) | 5 | [ ] |
| A5 | Region → city picker (17 regions) | Address / location | Adds province | 2 | [ ] |
| A6 | Buyer specialisations, tools used, years of experience, business name | Optional profile fields on seller/reseller profile | Shown on public profile | 6 | [ ] |
| A7 | Seller's first listing inline at sign-up | Listing created after verification | — | 6 | [ ] |
| A8 | Owner-of-items declaration | Listing declaration checkbox | Logged with timestamp | 6 | [ ] |
| A9 | Marketing-updates consent | Separate consent record | DPA-compliant, granular | 2 | [ ] |
| A10 | Log in (email + password, show-password) | `/sign-in` | 2FA, passkeys, device list | 2 | [ ] |
| A11 | Forgot password | `/forgot-password` | Single-use, expiring token; rate-limited | 2 | [ ] |
| A12 | "Free for the first 100 users" | — | No fee to join `[CONFIRM business model]` | — | [ ] |

## Content and legal

| # | Reference feature | Our equivalent | Our upgrade | Phase | Done |
|---|---|---|---|---|---|
| C1 | Home hero with buyer / seller CTAs | `/` hero | Living Gram; shop + sell CTAs | 3 | [ ] |
| C2 | Trust chips (verified only, secure messaging, daily updates) | Trust wall | Since 2019, follower count, completed trades | 3 | [ ] |
| C3 | How it works, 3 steps | Pinned "How verification works" scroll scene | — | 3 | [ ] |
| C4 | About: mission, values, founder | `/about` | Luxx4less story, store photos | 7 | [ ] |
| C5 | Privacy policy (DPA rights) | `/privacy` | DPO contact, data export / delete in account | 7 | [ ] |
| C6 | Terms and conditions | `/terms` + `/prohibited-items`, `/refund-policy`, `/kyc-policy`, `/cookies` | — | 7 | [ ] |

## Beyond parity

Luxx Vault originals (Owner Studio, seller, buyer and reseller portals, trust tools) are planned in FEATURES.md. Items marked ★ there aren't on the reference site.
