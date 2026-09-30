import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Heart, Search, ShieldCheck } from "lucide-react";
import { Emblem, Lockup } from "@/components/brand/logo";
import { Magnetic } from "@/components/motion/magnetic";
import { CompactListingCard, EditorialProductCard } from "@/components/product/cards";
import { PlaceholderPhoto } from "@/components/product/placeholder-photo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, ProductBadge, TIERS, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { palette, themes } from "@/config/tokens";
import { contrastRatio } from "@/lib/contrast";
import { KARATS, KARAT_PURITY, formatPeso, phpPerGram } from "@/lib/pricing";
import { SAMPLE_START } from "@/lib/sample-price-data";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

const SWATCHES: { key: keyof typeof palette; name: string; use: string; derived?: boolean; background?: boolean }[] = [
  { key: "velvet", name: "Velvet", use: "Dark background — aubergine-black, not flat black", background: true },
  { key: "velvetRaised", name: "Velvet raised", use: "Cards and panels on velvet", background: true },
  { key: "champagne", name: "Champagne", use: "Gold accent, prices and CTAs on dark" },
  { key: "bullion", name: "Bullion", use: "Pressed gold; large gold text and icons on light" },
  { key: "bullionInk", name: "Bullion ink", use: "Small gold text on light (bullion is only 3.1:1 there)", derived: true },
  { key: "pearl", name: "Pearl", use: "Light background — cool pearl, not cream", background: true },
  { key: "ice", name: "Ice", use: "Diamond accent: verification, sparkle, focus on dark" },
  { key: "iceDeep", name: "Ice deep", use: "Focus ring on light (ice is 1.3:1 on pearl)", derived: true },
  { key: "ink", name: "Ink", use: "Body text on light" },
];

const STATUS: { key: "success" | "warning" | "danger"; name: string }[] = [
  { key: "success", name: "Success" },
  { key: "warning", name: "Warning" },
  { key: "danger", name: "Danger" },
];

const TYPE_SCALE = [
  { cls: "text-7xl", px: 95.4, sample: "₱8,288", display: true },
  { cls: "text-6xl", px: 76.3, sample: "Legit gold", display: true },
  { cls: "text-5xl", px: 61.0, sample: "since 2019", display: true },
  { cls: "text-4xl", px: 48.8, sample: "Tunay na ginto", display: true },
  { cls: "text-3xl", px: 39.1, sample: "Saudi rope chain", display: true },
  { cls: "text-2xl", px: 31.3, sample: "How verification works", display: true },
  { cls: "text-xl", px: 25, sample: "Section heading in the UI face", display: false },
  { cls: "text-lg", px: 20, sample: "Lead paragraph for product stories", display: false },
  { cls: "text-base", px: "16–18", sample: "Body copy. Weighed, tested and priced by the gram.", display: false },
  { cls: "text-sm", px: 14, sample: "Helper text and table cells", display: false },
  { cls: "text-xs", px: 12.8, sample: "Captions, badges and fine print", display: false },
];

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-14 sm:py-20">
      <h2 id={`${id}-title`} className="text-3xl sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="measure mt-3 text-muted">{lead}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Ratio({ fg, bg }: { fg: string; bg: string }) {
  const r = contrastRatio(fg, bg);
  const tone = r >= 4.5 ? "success" : r >= 3 ? "warning" : "danger";
  const label = r >= 4.5 ? "AA text" : r >= 3 ? "AA large/UI" : "fails";
  return (
    <Badge tone={tone} className="tabular">
      {r.toFixed(2)} · {label}
    </Badge>
  );
}

export default function DesignSystemPage() {
  // ₱/g of pure (24K, 0.999) gold at the sample price
  const pure = phpPerGram(SAMPLE_START.usdPerOz, SAMPLE_START.usdPhp) * KARAT_PURITY[24];
  const atKarat = (k: keyof typeof KARAT_PURITY) => phpPerGram(SAMPLE_START.usdPerOz, SAMPLE_START.usdPhp) * KARAT_PURITY[k];

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Lockup className="text-base" emblemClassName="size-9" />
          </div>
          <nav aria-label="Sections" className="hidden gap-5 text-sm text-muted lg:flex">
            {["Colour", "Type", "Buttons", "Badges", "Cards", "Logo", "Hero"].map((s) => (
              <a key={s} href={`#${s.toLowerCase()}`} className="rounded-sm hover:text-fg">
                {s}
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="py-14 sm:py-20">
          <p className="text-sm font-medium text-gold">Phase 1 · design board</p>
          <h1 className="mt-3 text-5xl sm:text-6xl">The Vault at Night</h1>
          <p className="measure mt-5 text-lg text-muted">
            A private jeweller&rsquo;s vault after hours: aubergine-black velvet, warm champagne gold, and the cold white sparkle of diamonds. Product pages
            sit on cool pearl so jewellery photographs true; market and hero pages sit on velvet. Toggle the theme above to review both.
          </p>
        </div>

        <Section id="colour" title="Colour" lead="Brand palette from the brief, plus three derived shades where a brief colour fails WCAG AA as text. Ratios are measured against pearl and velvet.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SWATCHES.map((s) => (
              <Card key={s.key} className="overflow-hidden">
                <div className="h-24 border-b border-line" style={{ background: palette[s.key] }} />
                <CardBody className="space-y-2 p-4 sm:p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {s.name} {s.derived && <span className="text-xs font-medium text-muted">(derived)</span>}
                    </p>
                    <code className="tabular text-xs text-muted">{palette[s.key]}</code>
                  </div>
                  <p className="text-sm text-muted">{s.use}</p>
                  {s.background ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted">body text on it</span>
                      <Ratio fg={s.key === "pearl" ? palette.ink : palette.mist} bg={palette[s.key]} />
                      <span className="text-muted">muted text</span>
                      <Ratio fg={s.key === "pearl" ? palette.inkMuted : palette.mistMuted} bg={palette[s.key]} />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted">on pearl</span> <Ratio fg={palette[s.key]} bg={palette.pearl} />
                      <span className="text-muted">on velvet</span> <Ratio fg={palette[s.key]} bg={palette.velvet} />
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>

          <h3 className="mt-12 font-sans text-lg font-semibold">Status colours</h3>
          <p className="measure mt-1 text-sm text-muted">Used for status only. Each has a deeper shade for text on light and a brighter one for text on dark.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {STATUS.map((s) => (
              <Card key={s.key}>
                <CardBody className="space-y-3 p-4 sm:p-4">
                  <div className="flex gap-2">
                    <span className="h-10 flex-1 rounded-md" style={{ background: palette[s.key] }} />
                    <span className="h-10 flex-1 rounded-md" style={{ background: themes.light[s.key] }} />
                    <span className="h-10 flex-1 rounded-md" style={{ background: themes.dark[s.key] }} />
                  </div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="tabular text-xs text-muted">
                    fill {palette[s.key]} · text on light {themes.light[s.key]} · text on dark {themes.dark[s.key]}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="type" title="Type" lead="Cinzel for display: headings, prices, product names and the wordmark. It is a capitals face, so lowercase letters render as small capitals. Plus Jakarta Sans for everything else. 1.25 scale from a 16px base; body eases from 16px to 18px. Tables use Jakarta's tabular figures.">
          <div className="divide-y divide-line">
            {TYPE_SCALE.map((t) => (
              <div key={t.cls} className="grid items-baseline gap-2 py-4 sm:grid-cols-[9rem_1fr]">
                <p className="tabular text-xs text-muted">
                  {t.cls} · {t.px}px · {t.display ? "Cinzel" : "Jakarta"}
                </p>
                <p className={`${t.cls} ${t.display ? "font-display font-semibold leading-[1.05]" : "font-sans"} ${t.sample.startsWith("₱") ? "tabular text-gold" : ""} truncate`}>
                  {t.sample}
                </p>
              </div>
            ))}
          </div>
          <Card className="mt-8">
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">Tabular figures</p>
                <table className="tabular mt-3 w-full text-sm">
                  <caption className="sr-only">Sample karat prices</caption>
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 font-medium">Karat</th>
                      <th className="py-1 text-right font-medium">Purity</th>
                      <th className="py-1 text-right font-medium">₱ / g</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KARATS.map((k) => (
                      <tr key={k} className="border-t border-line">
                        <td className="py-1.5">{k}K</td>
                        <td className="py-1.5 text-right">{(KARAT_PURITY[k] * 100).toFixed(1)}%</td>
                        <td className="py-1.5 text-right">{formatPeso(atKarat(k), true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Voice</p>
                <p className="font-display text-2xl">Tunay na ginto. Verified na tao.</p>
                <p className="text-muted">
                  Plain, warm, confident. English first, with natural Taglish in headlines and helper text. Sentence case everywhere; no all-caps labels and no arrows tacked onto
                  every link.
                </p>
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section id="buttons" title="Buttons" lead="The gold gradient appears only on the primary CTA. It carries a subtle magnetic pull on desktop. Hover, press and keyboard focus are shown on every variant.">
          <div className="grid gap-8 lg:grid-cols-2">
            {(["bg", "velvet"] as const).map((surface) => (
              <div key={surface} className={`${surface === "velvet" ? "surface-velvet" : "bg-surface"} space-y-6 rounded-xl border border-line p-6`}>
                <p className="text-sm text-muted">{surface === "velvet" ? "On velvet" : "On the current theme"}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Magnetic>
                    <Button>Shop gold</Button>
                  </Magnetic>
                  <Button variant="secondary">Sell your gold</Button>
                  <Button variant="solid">Continue</Button>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="quiet">
                    View certificate <ArrowUpRight aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" variant="secondary" aria-label="Save to wishlist">
                    <Heart aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Search">
                    <Search aria-hidden />
                  </Button>
                  <Button disabled>Disabled</Button>
                  <Button variant="danger" size="sm">
                    Report listing
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="badges" title="Badges" lead="A verification tier sits next to every name. Ice blue is reserved for identity; gold for Luxx4less itself.">
          <div className="space-y-8">
            <div>
              <h3 className="font-sans text-lg font-semibold">Verification tiers</h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TIERS.map((t) => (
                  <li key={t.tier} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
                    <TierBadge tier={t.tier} />
                    <span className="text-right text-xs text-muted">{t.long}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-sans text-lg font-semibold">Product and listing</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <ProductBadge kind="official" />
                <ProductBadge kind="pawnable" />
                <ProductBadge kind="certificate" />
                <ProductBadge kind="luxxTested" />
                <ProductBadge kind="diamond" />
              </div>
            </div>
            <div>
              <h3 className="font-sans text-lg font-semibold">Status</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="success">Paid</Badge>
                <Badge tone="warning">Awaiting payment</Badge>
                <Badge tone="danger">Disputed</Badge>
                <Badge tone="neutral">Draft</Badge>
                <Badge tone="warning">Prices delayed</Badge>
              </div>
            </div>
          </div>
        </Section>

        <Section id="cards" title="Cards" lead="Treatment follows hierarchy: flagship Luxx4less pieces get large editorial cards; marketplace listings get compact, trust-first cards. Hover a card on desktop for the gold spotlight.">
          <div className="grid gap-6 lg:grid-cols-12">
            <EditorialProductCard
              className="lg:col-span-8"
              name="Saudi Rope Chain"
              goldType="Saudi gold"
              karat={21}
              grams={15.4}
              pricePerGram={atKarat(21) * 1.12}
              pawnable
            />
            <Card className="surface-velvet flex flex-col justify-between lg:col-span-4">
              <CardBody>
                <p className="text-sm text-muted">Price card</p>
                <p className="mt-2 text-sm">22K · per gram</p>
                <p className="tabular font-display text-5xl text-gold">{formatPeso(atKarat(22))}</p>
                <p className="tabular mt-2 text-sm text-success">▲ 0.42% today</p>
              </CardBody>
              <CardBody className="border-t border-line pt-4 sm:pt-4">
                <dl className="tabular grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-muted">We buy at</dt>
                  <dd className="text-right">{formatPeso(atKarat(22) * 0.9)}</dd>
                  <dt className="text-muted">We sell at</dt>
                  <dd className="text-right">{formatPeso(atKarat(22) * 1.1)}</dd>
                </dl>
                <p className="mt-3 text-xs text-muted">Sample spreads · set by the owner in Phase 3</p>
              </CardBody>
            </Card>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CompactListingCard title="18K Japan gold bangle" karat={18} grams={12.3} price={atKarat(18) * 12.3 * 1.06} seller="Rhea M." tier={4} location="Quezon City" premiumPct={6} luxxTested />
            <CompactListingCard title="22K Saudi pendant set" karat={22} grams={6.8} price={atKarat(22) * 6.8 * 1.11} seller="JM Gold PH" tier={4} location="Cebu City" premiumPct={11} />
            <CompactListingCard title="24K bar, 10 g" karat={24} grams={10} price={pure * 10 * 0.8} seller="newseller_22" tier={3} location="Davao City" premiumPct={-20} />
          </div>
        </Section>

        <Section
          id="logo"
          title="Logo"
          lead="The Luxx4less logo from your Facebook page, redrawn as crisp vector artwork: the eight-point star frame in its original peach gold, the bevelled L with its channel of diamonds, and the wordmark. It stays sharp at any size and can move."
        >
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="surface-velvet overflow-hidden lg:col-span-7">
              <CardBody className="grid place-items-center gap-2 py-12">
                <Lockup layout="stacked" animate emblemClassName="size-56" />
                <p className="mt-6 max-w-sm text-center text-sm text-muted">
                  The living emblem: the frame draws itself in, then the diamonds catch the light one after another. Used for the page loader and brand moments;
                  it stays still for visitors who turn motion off.
                </p>
              </CardBody>
            </Card>
            <div className="grid gap-6 lg:col-span-5">
              <Card className="overflow-hidden">
                <div className="grid grid-cols-2">
                  <div className="surface-velvet grid place-items-center p-6">
                    <Emblem className="size-32" title="Luxx4less logo, original flat gold frame" />
                    <span className="mt-2 text-2xs text-muted">Original finish</span>
                  </div>
                  <div className="surface-velvet grid place-items-center border-l border-line p-6">
                    <Emblem frame="foil" className="size-32" title="Luxx4less logo, foil frame" />
                    <span className="mt-2 text-2xs text-muted">Foil finish</span>
                  </div>
                </div>
              </Card>
              <Card>
                <CardBody className="space-y-4">
                  <p className="text-sm font-semibold">Small sizes and single colour</p>
                  <div className="flex flex-wrap items-end gap-4" aria-label="Small sizes">
                    {[64, 32, 16].map((px) => (
                      <div key={px} className="flex flex-col items-center gap-1">
                        <div className="grid place-items-center rounded-md bg-velvet p-1.5">
                          <Emblem detail="simple" style={{ width: px, height: px }} title="" />
                        </div>
                        <span className="tabular text-2xs text-muted">{px}px</span>
                      </div>
                    ))}
                    <div className="flex flex-col items-center gap-1">
                      <div className="grid size-[76px] place-items-center rounded-[18px] bg-velvet">
                        <Emblem detail="simple" className="size-14" title="" />
                      </div>
                      <span className="text-2xs text-muted">app icon</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="grid place-items-center rounded-md border border-line bg-pearl p-1.5 text-bullion-ink">
                        <Emblem detail="mono" className="size-12" title="" />
                      </div>
                      <span className="text-2xs text-muted">on pearl</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted">Below 48px the frame drops its two octagons and the stones become one ice-blue channel, so the mark stays readable in a browser tab.</p>
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
            <Card className="surface-velvet">
              <CardBody className="space-y-3">
                <p className="text-sm text-muted">Header lockup, as on your Facebook cover</p>
                <Lockup className="text-2xl" emblemClassName="size-14" />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-3">
                <p className="text-sm text-muted">Watermark on every marketplace photo</p>
                <div className="relative overflow-hidden rounded-lg">
                  <PlaceholderPhoto label="Listing photo" className="aspect-video" />
                  <div className="absolute right-3 bottom-3 flex items-center gap-1.5 text-white/75 mix-blend-difference">
                    <Emblem detail="mono" className="size-7" title="" />
                    <span className="tabular text-2xs">LX-2026-004821</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section id="hero" title="Hero prototype" lead="The Living Gram: today's 24K price per gram in molten numerals, with karat chips, over a 3D gold bar that turns as you scroll and sinks into the featured grid.">
          <Card className="surface-velvet overflow-hidden">
            <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="size-4 text-ice" aria-hidden /> Full-screen scroll scene
                </p>
                <p className="mt-1 text-sm text-muted">
                  Uses a sample price. Reduced-motion and low-end devices get a still render of the bar instead of WebGL.
                </p>
              </div>
              <Magnetic>
                <Button asChild size="lg">
                  <Link href="/design-system/hero">Open the hero prototype</Link>
                </Button>
              </Magnetic>
            </CardBody>
          </Card>
        </Section>
      </main>
    </div>
  );
}
