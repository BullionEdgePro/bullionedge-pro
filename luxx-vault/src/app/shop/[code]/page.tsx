import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { ChevronRight, Crown, HandCoins, Radio, Store, Truck } from "lucide-react";
import { Gallery } from "@/components/marketplace/gallery";
import { JsonLd } from "@/components/marketplace/json-ld";
import { ShareButtons } from "@/components/marketplace/share-buttons";
import { AddToBag } from "@/components/shop/bag-forms";
import { ProductCard } from "@/components/shop/product-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ProductBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { CATEGORIES, FORMS, GOLD_TYPES, METALS, labelOf } from "@/config/catalog";
import { ADMIN_ROLES } from "@/config/roles";
import { formatPeso } from "@/lib/pricing";
import { layawaySchedule } from "@/lib/shop";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { getSpot } from "@/lib/server/marketplace/context";
import { gramsLabel, purityLabel } from "@/lib/server/marketplace/describe";
import { itemPurity, premiumLabel } from "@/lib/server/marketplace/valuation";
import { listShopProducts, productValuation } from "@/lib/server/shop/products";
import { getShopSettings, pickupBranches } from "@/lib/server/shop/settings";
import { getViewer } from "@/lib/server/viewer";

type Props = { params: Promise<{ code: string }> };

const load = cache(async (code: string) =>
  db.product.findUnique({ where: { code }, include: { images: { orderBy: { position: "asc" }, select: { mediaId: true } } } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = normaliseCode((await params).code, "LP");
  const p = code ? await load(code) : null;
  if (!p || p.status === "draft") return { title: "Piece not found", robots: { index: false } };
  const facts = [purityLabel(p), gramsLabel(Number(p.weightGrams))].filter(Boolean).join(" · ");
  const image = p.images[0] ? mediaUrl(p.images[0].mediaId) : undefined;
  return {
    title: `${p.title} (${p.code})`,
    description: `${facts}. Sold by ${brand.publicName}, priced from today's gold price. Pick up in store, delivery or layaway.`,
    alternates: { canonical: `/shop/${p.code}` },
    openGraph: { title: p.title, description: facts, images: image ? [{ url: image, alt: p.title }] : undefined },
    robots: p.status === "active" ? undefined : { index: false },
  };
}

export default async function ProductPage({ params }: Props) {
  const raw = (await params).code;
  const code = normaliseCode(decodeURIComponent(raw), "LP");
  if (!code) notFound();
  if (code !== raw) permanentRedirect(`/shop/${code}`);

  const [p, viewer] = await Promise.all([load(code), getViewer()]);
  if (!p) notFound();
  const isAdmin = Boolean(viewer?.roles.some((r) => ADMIN_ROLES.includes(r)));
  if (p.status === "draft" && !isAdmin) notFound();

  const [{ spot, delayed }, settings, related] = await Promise.all([getSpot(), getShopSettings(), listShopProducts({ category: p.category, limit: 5 })]);
  const v = productValuation(p, spot);
  const purity = itemPurity(p);
  const pureSpot = p.metal ? spot[p.metal as keyof typeof spot] : undefined;
  const available = p.status === "active" && p.stock > 0 && v.pricePhp !== null;
  const photos = p.images.map((i) => ({ id: i.mediaId, url: mediaUrl(i.mediaId) }));
  const branches = pickupBranches();
  const layaway =
    settings.layawayEnabled && p.layawayAllowed && v.pricePhp !== null && v.pricePhp >= Number(settings.layawayMinPhp)
      ? layawaySchedule(v.pricePhp, settings.layawayDownPct, settings.layawayMonths, new Date(), new Date())
      : null;
  const others = related.filter((r) => r.id !== p.id && r.stock > 0).slice(0, 4);

  const specs: { label: string; value: string }[] = [
    { label: "Category", value: labelOf(CATEGORIES, p.category) },
    ...(p.metal ? [{ label: "Metal", value: labelOf(METALS, p.metal) }] : []),
    ...(purityLabel(p) ? [{ label: p.karat ? "Karat" : "Fineness", value: p.karat ? `${p.karat}K (${p.finenessPermille ?? ""})` : String(p.finenessPermille) }] : []),
    ...(p.goldType ? [{ label: "Gold type", value: labelOf(GOLD_TYPES, p.goldType) }] : []),
    ...(p.form ? [{ label: "Form", value: labelOf(FORMS, p.form) }] : []),
    { label: "Exact weight", value: `${Number(p.weightGrams).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} g` },
    { label: "Certificate", value: p.hasCertificate ? "Included" : "None" },
    { label: "Pawnable", value: p.pawnable === null ? "Ask us" : p.pawnable ? "Yes" : "No" },
    { label: "In stock", value: p.stock > 0 ? String(p.stock) : "Sold out" },
  ];

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main className="surface-velvet">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
            <Link href="/shop" className="hover:text-champagne">
              Official shop
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span className="truncate text-fg">{p.code}</span>
          </nav>
          {p.status !== "active" && (
            <p className="mt-4 rounded-xl border border-warning/30 bg-warning-tint px-4 py-3 text-sm font-semibold text-warning">
              {p.status === "draft" ? "Draft: only shop admins can see this page." : "This piece is no longer for sale."}
            </p>
          )}

          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Gallery photos={photos} title={p.title} isPrivate={p.status === "draft"} />
            </div>

            <div className="grid content-start gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xs tracking-[0.24em] text-champagne tabular">{p.code}</span>
                  <ProductBadge kind="official" />
                  {p.hasCertificate && <ProductBadge kind="certificate" />}
                  {p.pawnable && <ProductBadge kind="pawnable" />}
                </div>
                <h1 className="mt-3 text-3xl text-pearl sm:text-4xl">{p.title}</h1>
                <p className="mt-2 text-muted tabular">
                  {[purityLabel(p), p.goldType && p.goldType !== "other" ? labelOf(GOLD_TYPES, p.goldType) : "", gramsLabel(Number(p.weightGrams))].filter(Boolean).join(" · ")}
                </p>
              </div>

              <div className="rounded-2xl border border-champagne/30 bg-[linear-gradient(135deg,rgb(214_178_110/0.1),transparent_55%)] p-5 sm:p-6">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{v.live ? "Price today" : "Price"}</p>
                {v.pricePhp !== null ? (
                  <p className="mt-1 font-display text-5xl leading-none text-gold-metal tabular animate-molten">{formatPeso(v.pricePhp)}</p>
                ) : (
                  <p className="mt-2 text-muted">Live prices are unavailable, so this piece&rsquo;s price can&rsquo;t be shown right now.</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {v.premiumPct !== null && <span className="font-semibold text-fg tabular">{premiumLabel(v.premiumPct)}</span>}
                  {v.live && (
                    <span className="inline-flex items-center gap-1.5 text-champagne">
                      <Radio className="size-3.5" aria-hidden /> Moves with today&rsquo;s gold price until you order
                    </span>
                  )}
                  {delayed && <span className="text-warning">Prices delayed</span>}
                </div>
                {layaway && (
                  <p className="mt-4 flex gap-2 text-sm text-fg/90">
                    <HandCoins className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                    <span>
                      Layaway: <strong className="tabular">{formatPeso(layaway[0]!.amountPhp)}</strong> down, then {layaway.length - 1} monthly payments of about{" "}
                      <strong className="tabular">{formatPeso(layaway[1]!.amountPhp)}</strong>. The piece is reserved for you until it&rsquo;s paid.
                    </span>
                  </p>
                )}
              </div>

              {available ? (
                viewer ? (
                  <AddToBag productId={p.id} stock={p.stock} />
                ) : (
                  <div className="grid gap-2">
                    <Button asChild size="lg" className="sm:w-fit">
                      <Link href={`/sign-in?next=${encodeURIComponent(`/shop/${p.code}`)}`}>Sign in to buy</Link>
                    </Button>
                    <p className="text-sm text-muted">
                      New here?{" "}
                      <Link href={`/sign-up?next=${encodeURIComponent(`/shop/${p.code}`)}`} className="font-semibold text-champagne underline-offset-4 hover:underline">
                        Create a free account
                      </Link>{" "}
                      in a minute.
                    </p>
                  </div>
                )
              ) : (
                <p className="rounded-xl border border-line px-4 py-3 text-sm text-muted">
                  {p.stock <= 0 ? "Sold out. Message us on Facebook to ask about similar pieces." : "Not available to order right now."}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <ShareButtons path={`/shop/${p.code}`} />
                {isAdmin && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/admin/shop/${p.code}`}>Edit in admin</Link>
                  </Button>
                )}
              </div>

              <section aria-labelledby="get-title" className="grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm">
                <h2 id="get-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
                  Pay and receive your way
                </h2>
                <p className="flex gap-3">
                  <Store className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                  <span>
                    <strong className="text-fg">Pick up and pay in store</strong>
                    <span className="block text-muted">{branches.map((b) => b.name).join(" or ")}. We hold it for {settings.reserveDays} days.</span>
                  </span>
                </p>
                <p className="flex gap-3">
                  <Truck className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                  <span>
                    <strong className="text-fg">Delivery or meet-up</strong>
                    <span className="block text-muted">
                      Pay by GCash or bank transfer{settings.codEnabled ? ", or in cash on delivery" : ""}.{" "}
                      {settings.deliveryFeePhp === null ? "Delivery fee confirmed after you order." : Number(settings.deliveryFeePhp) > 0 ? `Delivery ${formatPeso(Number(settings.deliveryFeePhp))}.` : "Free delivery."}
                    </span>
                  </span>
                </p>
                <p className="flex gap-3">
                  <Crown className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                  <span className="text-muted">
                    Our payment details appear only on your own order page after you order. We never send different account details by chat.
                  </span>
                </p>
              </section>

              <section aria-labelledby="breakdown-title" className="rounded-2xl border border-line bg-surface p-5">
                <h2 id="breakdown-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
                  Live price breakdown
                </h2>
                {purity !== null && pureSpot && v.meltPhp !== null ? (
                  <dl className="mt-4 grid gap-2 text-sm tabular">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Weight</dt>
                      <dd>{Number(p.weightGrams)} g</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">× Purity ({purityLabel(p)})</dt>
                      <dd>{purity.toFixed(3)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">× Pure {p.metal} spot, per gram</dt>
                      <dd>{formatPeso(pureSpot, true)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
                      <dt>= Melt value today</dt>
                      <dd>{formatPeso(v.meltPhp)}</dd>
                    </div>
                    {v.pricePhp !== null && v.premiumPct !== null && (
                      <>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">{v.premiumPct >= 0 ? "+ Workmanship and design" : "− Below melt"}</dt>
                          <dd>
                            {formatPeso(Math.abs(v.pricePhp - v.meltPhp))} ({v.premiumPct >= 0 ? "+" : "−"}
                            {Math.abs(v.premiumPct).toFixed(1)}%)
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold text-gold">
                          <dt>= Price</dt>
                          <dd>{formatPeso(v.pricePhp)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    {purity === null ? "Stones and mixed pieces have no melt value to compare against." : "Live metal prices are unavailable right now, so the melt value can't be computed."}
                  </p>
                )}
              </section>

              <section aria-labelledby="specs-title">
                <h2 id="specs-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
                  Details
                </h2>
                <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
                  {specs.map((s) => (
                    <div key={s.label} className="flex justify-between gap-4 border-b border-line py-2.5 text-sm">
                      <dt className="text-muted">{s.label}</dt>
                      <dd className="text-right font-semibold text-fg tabular">{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 text-sm leading-relaxed whitespace-pre-line text-fg/90">{p.description}</div>
              </section>
            </div>
          </div>

          {others.length > 0 && (
            <section aria-labelledby="more-title" className="mt-16">
              <h2 id="more-title" className="text-2xl text-pearl">
                More from the shop
              </h2>
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {others.map((c) => (
                  <li key={c.id}>
                    <ProductCard card={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          sku: p.code,
          brand: { "@type": "Brand", name: brand.siteName },
          description: p.description.slice(0, 500),
          ...(photos[0] ? { image: photos.map((x) => x.url) } : {}),
          ...(p.metal ? { material: labelOf(METALS, p.metal) } : {}),
          weight: { "@type": "QuantitativeValue", value: Number(p.weightGrams), unitCode: "GRM" },
          ...(v.pricePhp !== null
            ? {
                offers: {
                  "@type": "Offer",
                  price: v.pricePhp,
                  priceCurrency: "PHP",
                  availability: available ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
                  url: `/shop/${p.code}`,
                  seller: { "@type": "Organization", name: brand.publicName },
                },
              }
            : {}),
        }}
      />
    </>
  );
}
