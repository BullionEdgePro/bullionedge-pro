import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { expect as baseExpect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { totp } from "./totp";

/**
 * The marketplace end to end (brief §7–§9), one person per browser context:
 * a guest, a Tier 1 member, a Tier 4 seller without two-step sign-in, the
 * seller, an ID-verified buyer and an admin.
 *
 *   SELLER_TOTP_SECRET=… ADMIN_TOTP_SECRET=… npx playwright test e2e/marketplace.spec.ts
 *
 * The two secrets belong to seller@luxx.test and admin@luxx.test (both have
 * two-step sign-in on). They are read from the environment and never stored
 * in the repo. Every page in the journey is also checked at 390 px for
 * horizontal overflow, and any page error or console error fails the test.
 *
 * Re-runnable: everything this spec creates carries a unique "E2E <run>"
 * title, and leftovers from earlier runs are taken off the market first so
 * the seller's new-seller listing cap is never eaten by old test data.
 * Local databases only.
 */

const DEV_PASSWORD = "Luxx-Dev-Vault-2026!"; // scripts/dev-users.ts (local accounts only)
const SELLER_TOTP = process.env.SELLER_TOTP_SECRET?.trim() ?? "";
const ADMIN_TOTP = process.env.ADMIN_TOTP_SECRET?.trim() ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);

const RUN = Date.now().toString(36).toUpperCase();
const TITLE_A = `E2E ${RUN} 18K Saudi rope necklace`;
const TITLE_B = `E2E ${RUN} 18K local bracelet, priced low`;
const WANTED_TITLE = `E2E ${RUN} wanted 18K Saudi bracelet`;
const PHOTOS = ["public/images/team/team-formal-960.webp", "public/images/team/team-candid-960.webp"];
const FLAGGED = "Can you text me on 0917 123 4567? I'd rather you send to my GCash so we can finish faster.";
const CLEAN = "Is the clasp original, and is the hallmark clear on the scale photo?";

// The dev server compiles each route on first visit; give navigations room.
const expect = baseExpect.configure({ timeout: 20_000 });

// A Tier 4 seller who has NOT turned on two-step sign-in (created here; see beforeAll).
const NO2FA = { email: "e2e-no2fa-seller@luxx.test", handle: "e2e-no2fa-seller", password: `E2e-${randomBytes(9).toString("base64url")}` };

test.skip(!LOCAL_DB, "marketplace e2e writes test data: local databases only");
test.skip(!SELLER_TOTP || !ADMIN_TOTP, "set SELLER_TOTP_SECRET and ADMIN_TOTP_SECRET");
test.describe.configure({ mode: "serial", timeout: 240_000 });

// ------------------------------------------------------------------ people

type Person = { name: string; ctx: BrowserContext; page: Page; errors: string[] };
const people: Person[] = [];

async function person(browser: Browser, name: string): Promise<Person> {
  // Filipino users, a Philippine clock: the server may run in any time zone.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", locale: "en-PH", timezoneId: "Asia/Manila", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const p: Person = { name, ctx, page, errors: [] };
  page.on("pageerror", (err) => p.errors.push(`[${name}] pageerror on ${page.url()}: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") p.errors.push(`[${name}] console.error on ${page.url()}: ${msg.text()}`);
  });
  page.on("dialog", (d) => void d.accept()); // confirm() before accept/decline/withdraw
  people.push(p);
  return p;
}

async function signIn(page: Page, email: string, password: string, secret?: string) {
  await go(page, "/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (secret) {
    await expect(page).toHaveURL(/\/sign-in\/two-factor/);
    // The code field is controlled: typing before hydration is lost, so re-type until the button wakes up.
    const field = page.getByLabel("6-digit code");
    const cont = page.getByRole("button", { name: "Continue" });
    await expect(async () => {
      await field.fill(totp(secret));
      await expect(cont).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await cont.click();
  }
  await expect(page).toHaveURL(/\/account$/);
}

/** No horizontal scrolling at 390 px (iPhone 12–15 width), then back to desktop. */
async function at390(page: Page) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const { sw, iw, wide } = await page.evaluate(() => {
    const iw = window.innerWidth;
    // For the failure message: the outermost elements that stick out without a clipping ancestor.
    const clipped = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        if (o !== "visible") return true;
      }
      return false;
    };
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > iw + 1 && getComputedStyle(el).position !== "fixed" && !clipped(el))
      .slice(0, 4)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
    return { sw: document.documentElement.scrollWidth, iw, wide };
  });
  expect(sw, `horizontal overflow at 390px on ${page.url()} (${wide.join(" | ")})`).toBeLessThanOrEqual(iw);
  if (before) await page.setViewportSize(before);
}

/** Navigate and wait until the page has settled (client components hydrated). */
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function visit(page: Page, url: string) {
  await go(page, url);
  await at390(page);
}

const pesoNumber = (text: string | null) => Number((text ?? "").replace(/[^\d.]/g, ""));
const formatPeso = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

// ------------------------------------------------------------------ database

let db: Client;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] as T;
const userId = async (email: string) => (await one<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email])).id;

/** Take everything earlier runs left behind off the market, so the seller's cap of 5 active listings holds room. */
async function cleanUp() {
  await db.query(`UPDATE dispute SET status = 'resolved_buyer', resolution = 'E2E cleanup', "resolvedAt" = now()
                  WHERE status = 'open' AND "tradeId" IN (SELECT t.id FROM trade t JOIN listing l ON l.id = t."listingId" WHERE l.title LIKE 'E2E %')`);
  await db.query(`UPDATE trade SET status = 'cancelled' WHERE status IN ('awaiting_payment','payment_held','shipped','received','disputed')
                  AND ("listingId" IN (SELECT id FROM listing WHERE title LIKE 'E2E %') OR "buyRequestId" IN (SELECT id FROM buy_request WHERE title LIKE 'E2E %'))`);
  await db.query(`UPDATE offer SET status = 'withdrawn' WHERE status = 'pending'
                  AND ("listingId" IN (SELECT id FROM listing WHERE title LIKE 'E2E %') OR "buyRequestId" IN (SELECT id FROM buy_request WHERE title LIKE 'E2E %'))`);
  await db.query(`UPDATE listing SET status = 'removed' WHERE title LIKE 'E2E %' AND status IN ('active','reserved','expired','draft')`);
  await db.query(`UPDATE buy_request SET status = 'closed' WHERE title LIKE 'E2E %' AND status IN ('open','fulfilled','expired')`);
  await db.query(`UPDATE report SET status = 'dismissed', "handledAt" = now() WHERE status = 'open' AND details LIKE 'E2E %'`);
}

/** A verified (Tier 4) seller account with two-step sign-in OFF, for the selling gate. */
async function ensureNo2faSeller() {
  const now = new Date();
  const id = "e2e_no2fa_seller";
  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", role, "twoFactorEnabled", "createdAt", "updatedAt")
     VALUES ($1, 'Nina No-Twofa', $2, true, 'buyer,seller', false, $3, $3)
     ON CONFLICT (email) DO UPDATE SET "emailVerified" = true, role = 'buyer,seller', "twoFactorEnabled" = false, "updatedAt" = $3`,
    [id, NO2FA.email, now],
  );
  const uid = await userId(NO2FA.email);
  await db.query(`DELETE FROM "twoFactor" WHERE "userId" = $1`, [uid]);
  await db.query(`DELETE FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`, [uid]);
  const pw = await hash(NO2FA.password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, $4, $4)`, [
    `${id}_cred`,
    uid,
    pw,
    now,
  ]);
  await db.query(
    `INSERT INTO profile ("userId", handle, "displayName", phone, "phoneVerifiedAt", "regionCode", "provinceCode", "cityCode", "identityVerifiedAt", "sellerVerifiedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Nina No-Twofa', '+639170000001', $3, '040000000', '045800000', '045802000', $3, $3, $3, $3)
     ON CONFLICT ("userId") DO UPDATE SET "phoneVerifiedAt" = $3, "identityVerifiedAt" = $3, "sellerVerifiedAt" = $3, "updatedAt" = $3`,
    [uid, NO2FA.handle, now],
  );
}

// ------------------------------------------------------------------ shared state

let guest: Person, tier1: Person, no2fa: Person, seller: Person, buyer: Person, admin: Person;
let codeA = "";
let priceA = 0;
let codeB = "";
let priceB = 0;
let tradeA = "";
let tradeB = "";
let wantedCode = "";

test.beforeAll(async ({ browser }) => {
  db = new Client({ connectionString: DB_URL });
  await db.connect();
  await db.query('DELETE FROM "rateLimit"');
  await cleanUp();
  await ensureNo2faSeller();

  guest = await person(browser, "guest");
  tier1 = await person(browser, "tier1");
  no2fa = await person(browser, "no2fa-seller");
  seller = await person(browser, "seller");
  buyer = await person(browser, "buyer");
  admin = await person(browser, "admin");
  await signIn(tier1.page, "tier1@luxx.test", DEV_PASSWORD);
  await signIn(no2fa.page, NO2FA.email, NO2FA.password);
  await signIn(seller.page, "seller@luxx.test", DEV_PASSWORD, SELLER_TOTP);
  await signIn(buyer.page, "tier3@luxx.test", DEV_PASSWORD);
  await signIn(admin.page, "admin@luxx.test", DEV_PASSWORD, ADMIN_TOTP);
});

test.afterEach(() => {
  const errors = people.flatMap((p) => p.errors.splice(0));
  expect(errors, "page errors or console errors (hydration included)").toEqual([]);
});

test.afterAll(async () => {
  for (const p of people) await p.ctx.close();
  if (db) {
    await cleanUp();
    await db.end();
  }
});

// ------------------------------------------------------------------ gates

test("a guest can browse the marketplace", async () => {
  const { page } = guest;
  await visit(page, "/marketplace");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Gold, traded between verified people.");
  await expect(page.getByRole("link", { name: /For sale/ })).toBeVisible();
  await expect(page.locator("#trade-tape-title")).toBeVisible();
  await visit(page, "/marketplace?tab=wanted");
  await expect(page.getByRole("link", { name: /Wanted/ }).first()).toHaveAttribute("aria-current", "page");
});

test("a seller without two-step sign-in is sent to turn it on", async () => {
  const { page } = no2fa;
  await go(page, "/marketplace/sell");
  await expect(page).toHaveURL(/\/account\/security\?require2fa=1&next=%2Fmarketplace%2Fsell/);
  await expect(page.getByText("Your role needs two-step sign-in. Turn it on below to continue.")).toBeVisible();
  await at390(page);
  // The upload endpoint refuses too: the gate is on the server, not just the page.
  const res = await page.request.post("/api/media", { multipart: { purpose: "listing", file: { name: "x.webp", mimeType: "image/webp", buffer: Buffer.from("x") } } });
  expect(res.status()).toBe(403);
});

// ------------------------------------------------------------------ listing

test("the seller lists an 18K Saudi necklace through the wizard", async () => {
  const { page } = seller;
  await visit(page, "/marketplace/sell");
  await expect(page.getByRole("heading", { name: "List an item" })).toBeVisible();

  // 1 · photos
  await page.locator('input[type="file"]').setInputFiles(PHOTOS);
  await expect.poll(async () => JSON.parse(await page.locator('input[name="photos"]').inputValue()).length, { timeout: 30_000 }).toBe(2);
  await expect(page.getByText("Cover")).toBeVisible();
  const photoIds = JSON.parse(await page.locator('input[name="photos"]').inputValue()) as string[];
  // Before publishing, a draft photo is private to its owner.
  const draft = await page.request.get(`/api/media/${photoIds[0]}`);
  expect(draft.status()).toBe(200);
  expect(draft.headers()["cache-control"]).toContain("no-store");
  const draftBytes = await draft.body();
  expect((await guest.page.request.get(`/api/media/${photoIds[0]}`)).status()).toBe(404);
  await at390(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // 2 · the piece
  await page.getByRole("button", { name: "Gold jewellery", exact: true }).click();
  await page.getByRole("button", { name: /^18K/ }).click();
  await page.getByLabel("Gold type").selectOption("saudi");
  await page.getByLabel("Form", { exact: true }).selectOption("necklace");
  await page.getByLabel("Exact weight (grams)").fill("3");
  await page.getByLabel("Title", { exact: true }).fill(TITLE_A);
  await at390(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // 3 · price: above melt, open to offers
  const meltText = await page.locator("p", { hasText: /^Melt value today$/ }).locator("xpath=following-sibling::p[1]").textContent();
  const melt = pesoNumber(meltText);
  expect(melt, "live melt value shown in the wizard").toBeGreaterThan(1000);
  priceA = Math.round((melt * 1.3) / 100) * 100;
  expect(priceA).toBeLessThanOrEqual(150_000); // new-seller cap
  await page.getByLabel("Your price (₱)").fill(String(priceA));
  await expect(page.locator("p", { hasText: /^Buyers see ₱/ })).toHaveText(new RegExp(`^Buyers see ${formatPeso(priceA)}\\+\\d+\\.\\d% over melt$`));
  await expect(page.getByLabel(/^Open to offers/)).toBeChecked();
  await at390(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // 4 · details
  await page.getByLabel("Description").fill("Solid 18K Saudi rope necklace, 3 g on a calibrated scale. Clear 750 hallmark on the clasp. Light wear.");
  await at390(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // 5 · publish
  await page.getByLabel(/I own this item/).check();
  await at390(page);
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/marketplace\/LX-[A-Z0-9]{5}\?published=1/);
  codeA = /LX-[A-Z0-9]{5}/.exec(page.url())![0];
  await expect(page.getByText("Your listing is live.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE_A);
  await expect(page.getByText("= Melt value today")).toBeVisible();
  await expect(page.getByText(/Seller's premium/)).toBeVisible();
  await expect(page.getByText(formatPeso(priceA)).first()).toBeVisible();
  await at390(page);

  const row = await one<{ status: string; images: string; openToOffers: boolean; pricePhp: string }>(
    `SELECT l.status, l."openToOffers", l."pricePhp", (SELECT count(*) FROM listing_image i WHERE i."listingId" = l.id) AS images FROM listing l WHERE code = $1`,
    [codeA],
  );
  expect(row).toMatchObject({ status: "active", openToOffers: true, images: "2" });
  expect(Number(row.pricePhp)).toBe(priceA);

  // The published photo is public, WebP, and was re-stamped with the watermark on attach.
  const img = page.getByRole("group", { name: /2 photos/ }).getByRole("img", { name: `${TITLE_A}, photo 1 of 2` });
  await expect(img).toBeVisible();
  expect(await img.getAttribute("src")).toContain(encodeURIComponent(`/api/media/${photoIds[0]}`)); // served through the image optimiser
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const pub = await guest.page.request.get(`/api/media/${photoIds[0]}`);
  expect(pub.status()).toBe(200);
  expect(pub.headers()["content-type"]).toBe("image/webp");
  expect(pub.headers()["cache-control"]).toContain("immutable");
  expect((await pub.body()).equals(draftBytes), "watermark applied when the photo was attached").toBe(false);
});

test("a Tier 1 member sees the verify prompt instead of offer and chat", async () => {
  const { page } = tier1;
  await visit(page, `/marketplace/${codeA}`);
  await expect(page.getByText("ID verification required")).toBeVisible();
  await expect(page.getByRole("link", { name: "Verify my identity" })).toHaveAttribute("href", `/account/verification?next=${encodeURIComponent(`/marketplace/${codeA}`)}`);
  await expect(page.getByRole("button", { name: "Make an offer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Chat with seller/ })).toHaveCount(0);
  await go(page, "/marketplace/wanted/new");
  await expect(page).toHaveURL(/\/account\/verification\?step=/);
});

// ------------------------------------------------------------------ offers

test("the buyer finds the listing with search and filters and makes an offer", async () => {
  const { page } = buyer;
  await go(page, "/marketplace");
  await page.locator("#mk-q").fill(RUN);
  await page.locator("#mk-q").press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${RUN}`));
  await page.locator("#mk-category").selectOption("gold_jewelry");
  await expect(page).toHaveURL(/category=gold_jewelry/);
  await page.locator("#mk-karat").selectOption("18");
  await expect(page).toHaveURL(/karat=18/);
  const card = page.locator("a", { hasText: TITLE_A });
  await expect(card).toBeVisible();
  await at390(page);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/marketplace/${codeA}$`));

  await page.getByRole("button", { name: "Make an offer" }).click();
  await page.getByLabel("Your offer (₱)").fill(String(Math.round(priceA * 0.8)));
  await page.getByLabel(/Note to the seller/).fill("Would you take a little less? Happy to pay into the hold today.");
  await at390(page);
  await page.getByRole("button", { name: "Send offer" }).click();
  await expect(page).toHaveURL(/\/account\/offers\?tab=sent/);
  const sent = page.locator("li", { hasText: codeA });
  await expect(sent.getByText("Waiting")).toBeVisible();
  await expect(sent).toContainText(formatPeso(Math.round(priceA * 0.8)));
  await at390(page);

  // A second buyer (the admin account is Tier 3) also offers, lower. It must be declined when a deal is struck.
  await go(admin.page, `/marketplace/${codeA}`);
  await admin.page.getByRole("button", { name: "Make an offer" }).click();
  await admin.page.getByLabel("Your offer (₱)").fill(String(Math.round(priceA * 0.7)));
  await admin.page.getByRole("button", { name: "Send offer" }).click();
  await expect(admin.page).toHaveURL(/\/account\/offers\?tab=sent/);
});

test("the seller counters and the buyer accepts: a trade opens and the item is reserved", async () => {
  const counter = Math.round(priceA * 0.9);
  const s = seller.page;
  await visit(s, "/account/offers");
  const received = s.locator("li", { hasText: codeA }).filter({ hasText: "From Bea Tier-Three" });
  await expect(received).toHaveCount(1);
  await expect(received.getByText("Waiting")).toBeVisible();
  await received.getByRole("button", { name: "Counter" }).click();
  await received.getByLabel("Your counter-offer (₱)").fill(String(counter));
  await received.getByRole("button", { name: "Send counter" }).click();
  // The list refreshes: the buyer's offer now reads "Countered", with no buttons left on it.
  await expect(received.getByText("Countered", { exact: true })).toBeVisible();
  await expect(received.getByRole("button", { name: "Accept" })).toHaveCount(0);

  const b = buyer.page;
  await visit(b, "/account/offers");
  const theCounter = b.locator("li", { hasText: codeA }).filter({ hasText: "Counter-offer" }).filter({ hasText: "Waiting" });
  await expect(theCounter).toContainText(formatPeso(counter));
  await theCounter.getByRole("button", { name: "Accept" }).click();
  await expect(b).toHaveURL(/\/account\/trades\/TR-[A-Z0-9]{5}$/);
  tradeA = /TR-[A-Z0-9]{5}/.exec(b.url())![0];
  await expect(b.getByText("Awaiting payment").first()).toBeVisible();

  const listing = await one<{ id: string; status: string }>(`SELECT id, status FROM listing WHERE code = $1`, [codeA]);
  expect(listing.status).toBe("reserved");
  const trade = await one<{ status: string; amountPhp: string; buyerId: string; sellerId: string }>(`SELECT status, "amountPhp", "buyerId", "sellerId" FROM trade WHERE code = $1`, [tradeA]);
  expect(trade.status).toBe("awaiting_payment");
  expect(Number(trade.amountPhp)).toBe(counter);
  expect(trade.buyerId).toBe(await userId("tier3@luxx.test"));
  expect(trade.sellerId).toBe(await userId("seller@luxx.test"));
  const offers = (await db.query<{ status: string; email: string }>(`SELECT o.status, u.email FROM offer o JOIN "user" u ON u.id = o."fromUserId" WHERE o."listingId" = $1 ORDER BY o."createdAt"`, [listing.id])).rows;
  expect(offers).toEqual([
    { status: "countered", email: "tier3@luxx.test" },
    { status: "declined", email: "admin@luxx.test" },
    { status: "accepted", email: "seller@luxx.test" },
  ]);
  // The listing now reads as reserved and takes no new offers.
  await go(guest.page, `/marketplace/${codeA}`);
  await expect(guest.page.getByText("Reserved: this item is in a trade.")).toBeVisible();
});

// ------------------------------------------------------------------ messages

test("chat: a phone number and an outside-payment request carry a warning for both sides", async () => {
  const b = buyer.page;
  await go(b, `/account/trades/${tradeA}`);
  await b.getByRole("link", { name: "Chat about this trade" }).click();
  await expect(b).toHaveURL(/\/account\/messages\/[a-z0-9]+$/);
  const threadUrl = new URL(b.url()).pathname;
  await expect(b.getByText(/Offer of .* accepted\. Trade TR-/)).toBeVisible(); // the system line from the accept

  const draft = b.locator("#chat-draft");
  await draft.fill(FLAGGED);
  await expect(b.getByRole("status").filter({ hasText: "If you send it, both of you will see a safety note" })).toBeVisible();
  await draft.press("Enter");
  const flagged = b.locator("ol > li", { hasText: FLAGGED });
  await expect(flagged.getByRole("note")).toContainText("Please read before replying");
  await expect(flagged.getByRole("note")).toContainText("A phone number was shared");
  await expect(flagged.getByRole("note")).toContainText("Payment outside Luxx4less was suggested");

  await draft.fill(CLEAN);
  await draft.press("Enter");
  const clean = b.locator("ol > li", { hasText: CLEAN });
  await expect(clean).toBeVisible();
  await expect(clean.getByRole("note")).toHaveCount(0);
  await at390(b);

  const stored = (await db.query<{ body: string; flags: string[] }>(`SELECT body, flags FROM message WHERE body IN ($1, $2)`, [FLAGGED, CLEAN])).rows;
  expect(stored.find((m) => m.body === FLAGGED)!.flags).toEqual(expect.arrayContaining(["phone_number", "off_platform_payment"]));
  expect(stored.find((m) => m.body === CLEAN)!.flags).toEqual([]);

  // The seller sees the same warning under the buyer's message, and none under the clean one.
  const s = seller.page;
  await visit(s, threadUrl);
  await expect(s.locator("ol > li", { hasText: FLAGGED }).getByRole("note")).toContainText("A phone number was shared");
  await expect(s.locator("ol > li", { hasText: CLEAN })).toBeVisible();
  await expect(s.locator("ol > li", { hasText: CLEAN }).getByRole("note")).toHaveCount(0);
});

// ------------------------------------------------------------------ trade

test("trade: pay into the hold, ship, confirm, release, review; showroom and trade tape update", async () => {
  const b = buyer.page;
  const s = seller.page;
  await visit(b, `/account/trades/${tradeA}`);
  await expect(b.getByText("Test mode: no money moves")).toBeVisible();
  await expect(b.getByText("Test mode: this simulates the hold. No money moves.")).toBeVisible();
  await b.getByRole("button", { name: /into protected hold/ }).click();
  // Each step's form leaves the page once the trade moves on, so the page itself is the confirmation.
  await expect(b.getByText("Your payment is safe in the hold.", { exact: false })).toBeVisible();
  expect((await one<{ status: string }>(`SELECT status FROM trade WHERE code = $1`, [tradeA])).status).toBe("payment_held");

  await visit(s, `/account/trades/${tradeA}`);
  await expect(s.getByText("Test mode: no money moves")).toBeVisible();
  await s.getByLabel("Courier").selectOption("LBC");
  await s.getByLabel("Tracking number").fill("LBC123456789PH");
  await s.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(s.getByText("Courier with tracking: LBC, tracking LBC123456789PH.", { exact: false })).toBeVisible();
  const shipped = await one<{ status: string; courier: string; trackingNumber: string }>(`SELECT status, courier, "trackingNumber" FROM trade WHERE code = $1`, [tradeA]);
  expect(shipped).toEqual({ status: "shipped", courier: "LBC", trackingNumber: "LBC123456789PH" });

  await b.reload();
  await expect(b.getByText("LBC · tracking LBC123456789PH")).toBeVisible();
  await b.getByLabel(/I have the item, I checked it/).check();
  await b.getByRole("button", { name: "I received it and it matches" }).click();
  await expect(b.getByText(/Completed \w+ \d+, \d{4}\./)).toBeVisible();
  expect((await one<{ status: string }>(`SELECT status FROM trade WHERE code = $1`, [tradeA])).status).toBe("released");
  expect((await one<{ status: string }>(`SELECT status FROM listing WHERE code = $1`, [codeA])).status).toBe("sold");

  // Reviews, both ways.
  await b.reload();
  await expect(b.getByText(/Completed \w+ \d+, \d{4}\./)).toBeVisible();
  await b.getByRole("button", { name: "5 stars" }).click();
  await b.getByLabel("A few words (optional)").fill(`E2E ${RUN}: exactly as described, shipped the same day.`);
  await at390(b);
  await b.getByRole("button", { name: "Post review" }).click();
  await expect(b.getByText("Your review", { exact: true })).toBeVisible();
  await s.reload();
  await s.getByRole("button", { name: "5 stars" }).click();
  await s.getByRole("button", { name: "Post review" }).click();
  await expect(s.getByText("Your review", { exact: true })).toBeVisible();
  await expect(s.getByText("Bea Tier-Three’s review of you")).toBeVisible();
  const reviews = await one<{ n: string }>(`SELECT count(*) AS n FROM review r JOIN trade t ON t.id = r."tradeId" WHERE t.code = $1`, [tradeA]);
  expect(reviews.n).toBe("2");

  // The seller's showroom shows the rating and the review.
  await visit(guest.page, "/sellers/migs-gold");
  await expect(guest.page.getByText(/\d\.\d of 5 \(\d+\)/)).toBeVisible();
  await expect(guest.page.getByText(`E2E ${RUN}: exactly as described, shipped the same day.`)).toBeVisible();

  // The home page trade tape shows the trade, anonymised: item, weight, place, a rounded price per gram.
  const trade = await one<{ amountPhp: string }>(`SELECT "amountPhp" FROM trade WHERE code = $1`, [tradeA]);
  await visit(guest.page, "/");
  const tape = guest.page.locator("section[aria-labelledby='trade-tape-title']");
  const first = tape.locator("ul.sr-only > li").first();
  await expect(first).toContainText("18K Saudi necklace, 3.0 g");
  await expect(first).toContainText(/about ₱[\d,]+\/g/);
  const tapeText = (await tape.textContent()) ?? "";
  for (const secret of ["Bea", "Tier-Three", "Migs", "migs-gold", tradeA, codeA, formatPeso(Number(trade.amountPhp))]) {
    expect(tapeText, `trade tape must not show ${secret}`).not.toContain(secret);
  }
});

// ------------------------------------------------------------------ below melt + report

test("a listing far below melt warns buyers to verify; a report reaches the admin queue", async () => {
  const { page } = seller;
  await go(page, "/marketplace/sell");
  await page.locator('input[type="file"]').setInputFiles(PHOTOS[0]!);
  await expect.poll(async () => JSON.parse(await page.locator('input[name="photos"]').inputValue()).length, { timeout: 30_000 }).toBe(1);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Gold jewellery", exact: true }).click();
  await page.getByRole("button", { name: /^18K/ }).click();
  await page.getByLabel("Gold type").selectOption("local");
  await page.getByLabel("Form", { exact: true }).selectOption("bracelet");
  await page.getByLabel("Exact weight (grams)").fill("4");
  await page.getByLabel("Title", { exact: true }).fill(TITLE_B);
  await page.getByRole("button", { name: "Continue" }).click();
  const melt = pesoNumber(await page.locator("p", { hasText: /^Melt value today$/ }).locator("xpath=following-sibling::p[1]").textContent());
  priceB = Math.round((melt * 0.5) / 100) * 100;
  await page.getByLabel("Your price (₱)").fill(String(priceB));
  await expect(page.getByText(/This is more than 10% under melt value/)).toBeVisible();
  await page.getByLabel(/^Open to offers/).uncheck();
  await at390(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Description").fill("18K local bracelet, 4 g. Priced to sell quickly; happy to meet at a branch for testing.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/I own this item/).check();
  await page.getByRole("button", { name: "Publish listing" }).click();
  // Not acknowledged yet: the server sends the seller back to the price step.
  await expect(page.getByRole("alert").filter({ hasText: "Tick the box to confirm the price is right." })).toBeVisible();
  await page.getByLabel("The price is right: publish it with the warning.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/marketplace\/LX-[A-Z0-9]{5}\?published=1/);
  codeB = /LX-[A-Z0-9]{5}/.exec(page.url())![0];
  await expect(page.getByText("Verify before buying")).toBeVisible();

  // The card in search carries the warning too.
  const b = buyer.page;
  await visit(b, `/marketplace?q=${RUN}`);
  const card = b.locator("a", { hasText: TITLE_B });
  await expect(card.getByText("Verify before buying")).toBeVisible();
  await visit(b, `/marketplace/${codeB}`);
  await expect(b.getByText("Verify before buying")).toBeVisible();

  // A member reports it; the admin sees it in the queue, then dismisses it.
  const t = tier1.page;
  await go(t, `/marketplace/${codeB}`);
  await t.getByRole("button", { name: "Report listing" }).click();
  const dialog = t.getByRole("dialog");
  await dialog.getByLabel("What's wrong?").selectOption("fake_item");
  await dialog.getByLabel(/Details/).fill(`E2E ${RUN}: far below melt, photos look like a studio shot.`);
  await at390(t);
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByText("Thank you. Our team reviews every report")).toBeVisible();
  expect((await one<{ reportCount: number }>(`SELECT "reportCount" FROM listing WHERE code = $1`, [codeB])).reportCount).toBe(1);

  const a = admin.page;
  await visit(a, "/admin/reports");
  const item = a.locator("li", { hasText: codeB });
  await expect(item).toContainText("Fake or misdescribed item");
  await expect(item).toContainText(`E2E ${RUN}: far below melt`);
  await item.getByRole("button", { name: "Dismiss" }).click();
  await expect(item).toHaveCount(0); // handled: off the open queue
  await visit(a, "/admin/reports?view=handled");
  await expect(a.locator("li", { hasText: codeB }).first()).toContainText("dismissed");
  expect((await one<{ reportCount: number; status: string }>(`SELECT "reportCount", status FROM listing WHERE code = $1`, [codeB]))).toEqual({ reportCount: 0, status: "active" });
});

// ------------------------------------------------------------------ wanted

test("wanted post: matching sellers are told, a seller answers, the buyer declines", async () => {
  const b = buyer.page;
  await visit(b, "/marketplace/wanted/new");
  await b.getByLabel("What are you looking for?").fill(WANTED_TITLE);
  await b.getByRole("button", { name: "18K", exact: true }).click();
  await b.getByLabel("Gold type (optional)").selectOption("saudi");
  await b.getByLabel("Max. weight (g)").fill("15");
  // Contact details are refused on the server, and what the buyer typed survives the correction.
  await b.getByLabel("Anything else sellers should know?").fill("Looking for a solid 18K Saudi bracelet. Text me on 0917 123 4567.");
  await b.getByRole("button", { name: "Post wanted request" }).click();
  await expect(b.getByText("Please leave phone numbers, account details and links out.", { exact: false })).toBeVisible();
  await expect(b.getByLabel("What are you looking for?")).toHaveValue(WANTED_TITLE);
  await expect(b.getByLabel("Max. weight (g)")).toHaveValue("15");
  await b.getByLabel("Anything else sellers should know?").fill("Looking for a solid 18K Saudi bracelet, 8 to 15 g, any design.");
  await b.getByRole("button", { name: "Post wanted request" }).click();
  await expect(b).toHaveURL(/\/marketplace\/wanted\/WP-[A-Z0-9]{5}\?posted=1&matched=\d+/);
  wantedCode = /WP-[A-Z0-9]{5}/.exec(b.url())![0];
  expect(Number(new URL(b.url()).searchParams.get("matched"))).toBeGreaterThanOrEqual(1);
  await expect(b.getByText(/with (a )?matching listings? (was|were) notified/)).toBeVisible();
  await at390(b);

  // The seller has active 18K jewellery listings, so they were told.
  const s = seller.page;
  await visit(s, "/account/notifications");
  const note = s.locator("li", { hasText: WANTED_TITLE });
  await expect(note).toContainText("A buyer is looking for something you sell");
  const n = await one<{ kind: string; href: string }>(`SELECT kind, href FROM notification WHERE "userId" = $1 AND body LIKE $2`, [await userId("seller@luxx.test"), `%${WANTED_TITLE}%`]);
  expect(n).toEqual({ kind: "request_match", href: `/marketplace/wanted/${wantedCode}` });

  await visit(s, `/marketplace/wanted/${wantedCode}`);
  await s.getByLabel("Your price (₱)").fill("90000");
  await s.getByLabel("Exact weight (g)").fill("12.5");
  await s.getByLabel(/^Note/).fill("18K Saudi curb bracelet, 12.5 g, clear hallmark. Photos in the chat.");
  await s.getByRole("button", { name: "Send offer" }).click();
  await expect(s).toHaveURL(/\/account\/offers\?tab=sent/);
  await expect(s.locator("li", { hasText: wantedCode })).toContainText("Waiting");

  await go(b, "/account/offers");
  const offer = b.locator("li", { hasText: wantedCode });
  await expect(offer).toContainText("From Migs Seller");
  await expect(offer.getByText("Waiting")).toBeVisible();
  await offer.getByRole("button", { name: "Decline" }).click();
  await expect(offer.getByText("Declined", { exact: true })).toBeVisible();
  const row = await one<{ status: string }>(`SELECT o.status FROM offer o JOIN buy_request r ON r.id = o."buyRequestId" WHERE r.code = $1`, [wantedCode]);
  expect(row.status).toBe("declined");
});

// ------------------------------------------------------------------ dispute

test("dispute: the buyer disputes a held payment and the admin refunds it", async () => {
  // The buyer requests the below-melt item at its asking price; the seller accepts.
  const b = buyer.page;
  await go(b, `/marketplace/${codeB}`);
  await b.getByRole("button", { name: /^Buy at/ }).click();
  await b.getByRole("button", { name: /^Send request/ }).click();
  await expect(b).toHaveURL(/\/account\/offers\?tab=sent/);

  const s = seller.page;
  await go(s, "/account/offers");
  await s.locator("li", { hasText: codeB }).filter({ hasText: "Waiting" }).getByRole("button", { name: "Accept" }).click();
  await expect(s).toHaveURL(/\/account\/trades\/TR-[A-Z0-9]{5}$/);
  tradeB = /TR-[A-Z0-9]{5}/.exec(s.url())![0];
  expect(Number((await one<{ amountPhp: string }>(`SELECT "amountPhp" FROM trade WHERE code = $1`, [tradeB])).amountPhp)).toBe(priceB);

  await go(b, `/account/trades/${tradeB}`);
  await b.getByRole("button", { name: /into protected hold/ }).click();
  await expect(b.getByText("Your payment is safe in the hold.", { exact: false })).toBeVisible();
  await b.getByRole("button", { name: /open a dispute/ }).click();
  await b.getByLabel("Reason").selectOption("not_received");
  await b.getByLabel("What happened?").fill(`E2E ${RUN}: the seller stopped replying after I paid into the hold.`);
  await at390(b);
  await b.getByRole("button", { name: "Open dispute" }).click();
  await expect(b.getByText("Dispute under review")).toBeVisible();
  expect((await one<{ status: string }>(`SELECT status FROM trade WHERE code = $1`, [tradeB])).status).toBe("disputed");

  const a = admin.page;
  await visit(a, "/admin/disputes");
  const d = a.getByRole("listitem").filter({ has: a.getByText(tradeB, { exact: true }) });
  await expect(d).toContainText("The item never arrived");
  await expect(d).toContainText("opened by the buyer");
  await d.getByLabel("Decision note (required)").fill("No tracking was ever provided; refunding the buyer in full.");
  await d.getByRole("button", { name: /For the buyer: refund/ }).click();
  await expect(d).toHaveCount(0); // decided: off the open list
  await visit(a, "/admin/disputes?view=resolved");
  await expect(a.getByRole("listitem").filter({ has: a.getByText(tradeB, { exact: true }) })).toContainText("No tracking was ever provided");

  const trade = await one<{ status: string; listing: string; dispute: string }>(
    `SELECT t.status, l.status AS listing, (SELECT status FROM dispute WHERE "tradeId" = t.id ORDER BY "createdAt" DESC LIMIT 1) AS dispute
     FROM trade t JOIN listing l ON l.id = t."listingId" WHERE t.code = $1`,
    [tradeB],
  );
  expect(trade).toEqual({ status: "refunded", listing: "expired", dispute: "resolved_buyer" });
  for (const email of ["tier3@luxx.test", "seller@luxx.test"]) {
    const note = await one<{ body: string }>(`SELECT body FROM notification WHERE "userId" = $1 AND title = $2`, [await userId(email), `Dispute resolved · ${tradeB}`]);
    expect(note?.body, `${email} is told the outcome`).toContain("Decided for the buyer: payment refunded.");
  }
  await visit(b, `/account/trades/${tradeB}`);
  await expect(b.getByText("Refunded to the buyer")).toBeVisible();
  await expect(b.getByText(/No tracking was ever provided/)).toBeVisible();
});

// ------------------------------------------------------------------ the rest of the account area at 390 px

test("account and staff pages hold together at 390 px", async () => {
  for (const url of ["/account", "/account/listings", "/account/offers", "/account/offers?tab=sent", "/account/messages", "/account/trades", "/account/saved", "/account/notifications", "/account/wanted"]) {
    await visit(buyer.page, url);
    await visit(seller.page, url);
  }
  await visit(seller.page, `/marketplace/wanted/${wantedCode}`);
  await visit(guest.page, `/marketplace/${codeA}`);
  for (const url of ["/admin/listings", "/admin/reports?view=handled", "/admin/disputes?view=resolved"]) await visit(admin.page, url);
});
