import type { Metadata } from "next";
import Link from "next/link";
import { BrandLines } from "@/components/about/brand-lines";
import { TeamFan } from "@/components/about/team-fan";
import { VisitorWall } from "@/components/about/visitor-wall";
import { Emblem } from "@/components/brand/logo";
import { BrandImage } from "@/components/media/brand-image";
import { GoldRule, Reveal, RisingWords } from "@/components/motion/reveal";
import { ParallaxFrame } from "@/components/motion/parallax-frame";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { imagesIn } from "@/content/brand-images";
import { LUXURY_LINES } from "@/content/lines";
import { FOUNDER, HOUSE_INTRO, HOUSE_OUTRO, RECOGNITION, TEAM, VISITS } from "@/content/people";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: `Behind the counter — ${brand.siteName}`,
  description:
    "The people behind Luxx4less Golds and Diamonds: the founder, the team who weigh every piece, " +
    "and the two branches you can walk into.",
};

export default async function AboutPage() {
  const session = await getSession();
  // The wall stays off until every guest on it has agreed to be shown.
  const visitPhotos = VISITS.published ? imagesIn("visits") : [];
  // An address the owner has not re-confirmed is worse than one fewer branch listed.
  const branches = brand.branches.filter((b) => !("confirm" in b && b.confirm));

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} overlay />

      <main className="surface-velvet">
        {/* ---------------------------------------------------------- opening */}
        <section className="relative isolate min-h-[88svh] overflow-hidden">
          <ParallaxFrame className="absolute inset-0 -z-10" depth={70} sheen={false}>
            <BrandImage
              id="store/store-front-antipolo"
              alt="The Luxx4less storefront, its gold sign reading Golds and Diamonds Jewelries"
              sizes="100vw"
              // Keep the shop sign in frame: the faces sit low in this snapshot.
              focus="center 9%"
              priority
            />
          </ParallaxFrame>
          {/* The photo is a street snapshot; this wash is what makes the type readable on it. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-b from-velvet/85 via-velvet/70 to-velvet"
          />

          <div className="mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-20 pt-[calc(var(--header-top,5.5rem)+7rem)] sm:px-6 lg:pt-[calc(var(--header-top,4.5rem)+9rem)]">
            <Reveal>
              <Emblem className="size-14 text-champagne" />
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 font-display text-xs uppercase tracking-[0.32em] text-champagne">
                {HOUSE_INTRO.eyebrow}
              </p>
            </Reveal>
            <RisingWords
              as="h1"
              text={HOUSE_INTRO.headline}
              delay={0.2}
              className="mt-4 max-w-3xl text-4xl text-pearl sm:text-5xl lg:text-6xl"
            />
            <Reveal delay={0.45}>
              <p className="measure mt-6 text-lg text-pearl/80">{HOUSE_INTRO.body}</p>
            </Reveal>
            <Reveal delay={0.6}>
              <p className="mt-6 font-display text-xl text-gold-metal animate-molten">{HOUSE_INTRO.motto}</p>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------------- founder */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <GoldRule className="mb-16 w-full" />
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6">
              <Reveal>
                <p className="font-display text-xs uppercase tracking-[0.32em] text-gold">{FOUNDER.eyebrow}</p>
              </Reveal>
              <RisingWords text={FOUNDER.headline} className="mt-4 text-3xl text-fg sm:text-4xl" />
              {FOUNDER.body.map((para, i) => (
                <Reveal key={i} delay={0.12 + i * 0.08}>
                  <p className="measure mt-5 text-muted">{para}</p>
                </Reveal>
              ))}
              {FOUNDER.name.value ? (
                <Reveal delay={0.3}>
                  <p className="mt-8 font-display text-lg text-gold">
                    {FOUNDER.name.value}
                    <span className="block text-sm font-normal tracking-wide text-muted">{FOUNDER.role.value}</span>
                  </p>
                </Reveal>
              ) : null}
            </div>

            <div className="lg:col-span-6">
              <Reveal delay={0.15}>
                <ParallaxFrame className="rounded-2xl" depth={34}>
                  <BrandImage
                    id="owner/owner-awards-night"
                    alt={RECOGNITION.items[2].alt}
                    sizes="(min-width: 1024px) 34rem, 92vw"
                    className="aspect-[4/5]"
                  />
                </ParallaxFrame>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- brand lines */}
        <section aria-label="What we stand for" className="surface-velvet border-t border-line py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <BrandLines lines={LUXURY_LINES} />
          </div>
        </section>

        {/* ---------------------------------------------------------- the team */}
        <section className="border-y border-line bg-surface-sunk py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <Reveal>
              <p className="font-display text-xs uppercase tracking-[0.32em] text-gold">{TEAM.eyebrow}</p>
            </Reveal>
            <RisingWords text={TEAM.headline} className="mt-4 text-3xl text-fg sm:text-4xl" />
            <Reveal delay={0.12}>
              <p className="measure mx-auto mt-5 text-muted">{TEAM.body}</p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-4 font-display text-lg text-gold">{TEAM.motto}</p>
            </Reveal>

            <TeamFan frames={TEAM.frames} />
          </div>
        </section>

        {/* ------------------------------------------------------ recognition */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <Reveal>
            <p className="font-display text-xs uppercase tracking-[0.32em] text-gold">{RECOGNITION.eyebrow}</p>
          </Reveal>
          <RisingWords text={RECOGNITION.headline} className="mt-4 text-3xl text-fg sm:text-4xl" />
          <Reveal delay={0.12}>
            <p className="measure mt-5 text-muted">{RECOGNITION.body}</p>
          </Reveal>

          <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {RECOGNITION.items.map((item, i) => (
              <Reveal as="li" key={item.id} delay={i * 0.1}>
                <figure>
                  <ParallaxFrame className="rounded-xl" depth={22} sheenDelay={0.2 + i * 0.12}>
                    <BrandImage
                      id={item.id}
                      alt={item.alt}
                      sizes="(min-width: 1024px) 22rem, (min-width: 640px) 46vw, 92vw"
                      className="aspect-[4/3]"
                    />
                  </ParallaxFrame>
                  <figcaption className="mt-4">
                    <p className="font-display text-lg text-fg">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.note}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------- visitors */}
        {visitPhotos.length > 0 ? (
          <section className="surface-velvet overflow-hidden border-y border-line py-24 lg:py-28">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <Reveal>
                <p className="font-display text-xs uppercase tracking-[0.32em] text-champagne">{VISITS.eyebrow}</p>
              </Reveal>
              <RisingWords text={VISITS.headline} className="mt-4 max-w-2xl text-3xl text-pearl sm:text-4xl" />
              <Reveal delay={0.12}>
                <p className="measure mt-5 text-pearl/75">{VISITS.body}</p>
              </Reveal>
            </div>
            <VisitorWall photos={visitPhotos} />
          </section>
        ) : null}

        {/* ------------------------------------------------------------ visit us */}
        <section id="visit" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-24 sm:px-6 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <RisingWords text={HOUSE_OUTRO.headline} className="text-3xl text-fg sm:text-4xl" />
              <Reveal delay={0.12}>
                <p className="measure mt-5 text-muted">{HOUSE_OUTRO.body}</p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/sign-up">Create an account</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <a href={brand.social.facebookUrl} target="_blank" rel="noreferrer noopener">
                      Message us on Facebook
                    </a>
                  </Button>
                </div>
              </Reveal>
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
              {branches.map((b, i) => (
                <Reveal as="li" key={b.name} delay={i * 0.1}>
                  <div className="h-full rounded-xl border border-line bg-surface p-6">
                    <p className="font-display text-lg text-gold">{b.name}</p>
                    <p className="mt-2 text-sm text-muted">{b.address}</p>
                    {b.main ? (
                      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">Main branch</p>
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
