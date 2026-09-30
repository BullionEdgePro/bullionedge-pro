/**
 * Demo marketplace content for LOCAL review: a handful of listings for the dev
 * sellers and wanted posts for the dev buyer, with generated placeholder
 * photos stamped "Demo photo". Run after `npm run dev:users`:
 *
 *   npx tsx scripts/seed-demo.ts            (add / replace the demo items)
 *   npx tsx scripts/seed-demo.ts --remove   (take them out again)
 *
 * LOCAL DATABASES ONLY: refuses unless DATABASE_URL points at localhost.
 * It never creates trades, reviews or ratings: those only come from real use,
 * so nothing here could pass for marketplace history.
 */
import "dotenv/config";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateCode } from "../src/lib/server/marketplace/codes";
import { processUpload, watermarkListingPhoto } from "../src/lib/server/marketplace/image-core";

const DEMO_MARK = "Demo listing for local review only. Not a real item.";
const DAY = 86_400_000;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  throw new Error("DATABASE_URL is not a valid URL.");
}
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error(`Refusing to seed demo data: DATABASE_URL host is "${host}", not localhost.`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type Shape = "ring" | "chain" | "bar" | "bangle" | "coin" | "earrings" | "pendant";

function art(shape: Shape, tint: string): string {
  const gold = `url(#g)`;
  const shapes: Record<Shape, string> = {
    ring: `<circle cx="600" cy="820" r="250" fill="none" stroke="${gold}" stroke-width="70"/><path d="M560 560 L600 500 L640 560 Z" fill="#eaf4fa" stroke="#bfd8e4" stroke-width="6"/>`,
    chain: Array.from({ length: 9 }, (_, i) => `<ellipse cx="${240 + i * 90}" cy="${820 + Math.sin(i / 1.4) * 60}" rx="62" ry="36" fill="none" stroke="${gold}" stroke-width="22" transform="rotate(${i % 2 ? 60 : -20} ${240 + i * 90} ${820 + Math.sin(i / 1.4) * 60})"/>`).join(""),
    bar: `<rect x="300" y="620" width="600" height="360" rx="36" fill="${gold}"/><rect x="340" y="660" width="520" height="280" rx="24" fill="none" stroke="#fff3c4" stroke-opacity=".5" stroke-width="6"/>`,
    bangle: `<ellipse cx="600" cy="820" rx="330" ry="250" fill="none" stroke="${gold}" stroke-width="56"/>`,
    coin: `<circle cx="600" cy="820" r="280" fill="${gold}"/><circle cx="600" cy="820" r="240" fill="none" stroke="#7a5520" stroke-opacity=".5" stroke-width="10"/>`,
    earrings: `<circle cx="440" cy="760" r="120" fill="none" stroke="${gold}" stroke-width="34"/><circle cx="760" cy="760" r="120" fill="none" stroke="${gold}" stroke-width="34"/>`,
    pendant: `<path d="M300 560 Q600 760 900 560" fill="none" stroke="${gold}" stroke-width="14"/><path d="M600 700 L700 860 L600 1020 L500 860 Z" fill="${gold}"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">
  <defs>
    <radialGradient id="bg" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="${tint}"/><stop offset=".6" stop-color="#1b1326"/><stop offset="1" stop-color="#120c19"/></radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e7bb"/><stop offset=".35" stop-color="#d6b26e"/><stop offset=".7" stop-color="#a8823f"/><stop offset="1" stop-color="#e2c17f"/></linearGradient>
  </defs>
  <rect width="1200" height="1500" fill="url(#bg)"/>
  ${shapes[shape]}
  <rect x="330" y="150" width="540" height="110" rx="55" fill="#17101f" fill-opacity=".8" stroke="#d6b26e" stroke-width="3"/>
  <text x="600" y="222" text-anchor="middle" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="52" font-weight="700" letter-spacing="6" fill="#d6b26e">DEMO PHOTO</text>
  <text x="600" y="1330" text-anchor="middle" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="34" fill="#b8aec4">Placeholder for local review. Not a real item.</text>
</svg>`;
}

type DemoListing = {
  seller: "seller@luxx.test" | "seller2@luxx.test";
  title: string;
  category: string;
  metal: string | null;
  karat?: number;
  fineness?: number;
  goldType?: string;
  form: string;
  shape: Shape;
  grams: number;
  pricing: { mode: "fixed"; php: number } | { mode: "spot_premium"; pct: number };
  offers: boolean;
  cert?: boolean;
  receipt?: boolean;
  pawnable?: boolean;
  region: string;
  province: string | null;
  city: string;
  tint: string;
};

const LISTINGS: DemoListing[] = [
  { seller: "seller@luxx.test", title: "18K Saudi gold rope chain, 20 inches", category: "gold_jewelry", metal: "gold", karat: 18, goldType: "saudi", form: "necklace", shape: "chain", grams: 12.4, pricing: { mode: "spot_premium", pct: 12 }, offers: true, receipt: true, pawnable: true, region: "040000000", province: "045800000", city: "045802000", tint: "#3a2a4c" },
  { seller: "seller@luxx.test", title: "21K Saudi bangle with engraved leaf pattern", category: "gold_jewelry", metal: "gold", karat: 21, goldType: "saudi", form: "bangle", shape: "bangle", grams: 18.2, pricing: { mode: "fixed", php: 142_000 }, offers: true, pawnable: true, region: "040000000", province: "045800000", city: "045805000", tint: "#2f2440" },
  { seller: "seller@luxx.test", title: "24K 10-gram minted gold bar with assay card", category: "gold_bullion", metal: "gold", karat: 24, goldType: "other", form: "bar", shape: "bar", grams: 10, pricing: { mode: "spot_premium", pct: 4 }, offers: false, cert: true, region: "040000000", province: "045800000", city: "045802000", tint: "#35273f" },
  { seller: "seller@luxx.test", title: "18K Japan gold hoop earrings", category: "gold_jewelry", metal: "gold", karat: 18, goldType: "japan", form: "earrings", shape: "earrings", grams: 3.6, pricing: { mode: "fixed", php: 19_500 }, offers: false, region: "130000000", province: null, city: "137602000", tint: "#2b2238" },
  { seller: "seller2@luxx.test", title: "18K Italian gold solitaire ring, size 6", category: "gold_jewelry", metal: "gold", karat: 18, goldType: "italian", form: "ring", shape: "ring", grams: 2.9, pricing: { mode: "fixed", php: 24_000 }, offers: true, cert: true, region: "130000000", province: null, city: "137404000", tint: "#3b2d47" },
  { seller: "seller2@luxx.test", title: "Broken 18K chain for scrap, weighed", category: "gold_jewelry", metal: "gold", karat: 18, goldType: "local", form: "scrap", shape: "chain", grams: 7.8, pricing: { mode: "fixed", php: 33_000 }, offers: true, region: "130000000", province: null, city: "137403000", tint: "#292033" },
  { seller: "seller2@luxx.test", title: "925 silver 1 oz round", category: "silver", metal: "silver", fineness: 925, form: "coin", shape: "coin", grams: 31.1, pricing: { mode: "spot_premium", pct: 18 }, offers: false, region: "070000000", province: "072200000", city: "072217000", tint: "#2a2a38" },
  { seller: "seller2@luxx.test", title: "22K Hong Kong gold pendant with fine chain", category: "gold_jewelry", metal: "gold", karat: 22, goldType: "hong_kong", form: "pendant", shape: "pendant", grams: 6.1, pricing: { mode: "fixed", php: 52_000 }, offers: true, receipt: true, region: "110000000", province: "112400000", city: "112402000", tint: "#33253f" },
];

const WANTED = [
  { title: "Looking for an 18K Saudi chain, 10 to 15 g", category: "gold_jewelry", metal: "gold", karat: 18, goldType: "saudi", form: "necklace", min: 10, max: 15, budget: 90_000, region: "040000000", province: "045800000", city: "045802000" },
  { title: "21K bangle around 20 g for my mother", category: "gold_jewelry", metal: "gold", karat: 21, goldType: null, form: "bangle", min: 18, max: 24, budget: 170_000, region: "130000000", province: null, city: null },
  { title: "Small 24K bar, 5 or 10 g, with certificate", category: "gold_bullion", metal: "gold", karat: 24, goldType: null, form: "bar", min: 5, max: 10, budget: null, region: "130000000", province: null, city: "137404000" },
];

async function userId(email: string): Promise<string> {
  const u = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!u) throw new Error(`${email} not found. Run \`npm run dev:users\` first.`);
  return u.id;
}

async function removeDemo() {
  const listings = await db.listing.findMany({ where: { description: { startsWith: DEMO_MARK } }, select: { id: true, images: { select: { mediaId: true } } } });
  const trades = await db.trade.count({ where: { listingId: { in: listings.map((l) => l.id) } } });
  if (trades) console.log(`  note: ${trades} test trade(s) reference demo listings; those listings are kept.`);
  const free = trades ? [] : listings.map((l) => l.id);
  await db.listing.deleteMany({ where: { id: { in: free } } });
  const freeMedia = listings.filter((l) => free.includes(l.id)).flatMap((l) => l.images.map((i) => i.mediaId));
  await db.mediaObject.deleteMany({ where: { id: { in: freeMedia } } });
  const wanted = await db.buyRequest.deleteMany({ where: { description: { startsWith: DEMO_MARK }, trades: { none: {} } } });
  console.log(`✓ removed ${free.length} demo listings and ${wanted.count} demo wanted posts`);
}

async function main() {
  await removeDemo();
  if (process.argv.includes("--remove")) return;

  const now = Date.now();
  for (const [i, l] of LISTINGS.entries()) {
    const sellerId = await userId(l.seller);
    let code = generateCode("LX");
    while (await db.listing.findUnique({ where: { code }, select: { id: true } })) code = generateCode("LX");
    const listing = await db.listing.create({
      data: {
        code,
        sellerId,
        title: l.title,
        category: l.category,
        metal: l.metal,
        karat: l.karat ?? null,
        finenessPermille: l.fineness ?? (l.karat ? { 24: 999, 22: 916, 21: 875, 18: 750 }[l.karat] ?? null : null),
        goldType: l.goldType ?? null,
        form: l.form,
        weightGrams: l.grams,
        pricingMode: l.pricing.mode,
        pricePhp: l.pricing.mode === "fixed" ? l.pricing.php : null,
        premiumPct: l.pricing.mode === "spot_premium" ? l.pricing.pct : null,
        openToOffers: l.offers,
        description: `${DEMO_MARK} ${l.title}. Weighed on a calibrated scale; hallmark visible. Photos are generated placeholders.`,
        hasCertificate: Boolean(l.cert),
        hasReceipt: Boolean(l.receipt),
        pawnable: l.pawnable ?? null,
        regionCode: l.region,
        provinceCode: l.province,
        cityCode: l.city,
        declaredOwnerAt: new Date(now - i * 3_600_000),
        createdAt: new Date(now - i * 5 * 3_600_000),
        expiresAt: new Date(now + 30 * DAY - i * 5 * 3_600_000),
      },
      select: { id: true, code: true },
    });
    const png = await sharp(Buffer.from(art(l.shape, l.tint))).png().toBuffer();
    const img = await processUpload(png);
    const wm = await watermarkListingPhoto(img.bytes, listing.code);
    const media = await db.mediaObject.create({
      data: { ownerId: sellerId, purpose: "listing", mime: img.mime, bytes: new Uint8Array(wm.bytes), width: img.width, height: img.height, sha256: img.sha256, phash: img.phash },
      select: { id: true },
    });
    await db.listingImage.create({ data: { listingId: listing.id, mediaId: media.id, position: 0 } });
    console.log(`✓ ${listing.code}  ${l.title}`);
  }

  const buyerId = await userId("tier3@luxx.test");
  for (const [i, w] of WANTED.entries()) {
    let code = generateCode("WP");
    while (await db.buyRequest.findUnique({ where: { code }, select: { id: true } })) code = generateCode("WP");
    await db.buyRequest.create({
      data: {
        code,
        buyerId,
        title: w.title,
        category: w.category,
        metal: w.metal,
        karat: w.karat,
        goldType: w.goldType,
        form: w.form,
        minGrams: w.min,
        maxGrams: w.max,
        budgetMaxPhp: w.budget,
        description: `${DEMO_MARK} ${w.title}.`,
        regionCode: w.region,
        provinceCode: w.province,
        cityCode: w.city,
        createdAt: new Date(now - i * 7 * 3_600_000),
        expiresAt: new Date(now + 30 * DAY),
      },
    });
    console.log(`✓ ${code}  ${w.title}`);
  }
  console.log("\nDemo content is local only. Remove it with: npx tsx scripts/seed-demo.ts --remove");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
