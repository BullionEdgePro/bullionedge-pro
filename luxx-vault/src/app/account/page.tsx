import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, BadgeCheck, CheckCircle2, Gavel, Handshake, Heart, LineChart, MessagesSquare, PackageSearch, ShieldCheck, Smartphone, Store, UserRoundCheck } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { Badge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { unreadCounts } from "@/lib/server/marketplace/conversations";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { sweepExpired } from "@/lib/server/marketplace/listings";
import { IN_PROGRESS } from "@/lib/server/marketplace/trades";
import { openNotification } from "@/lib/server/marketplace/actions/account";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Your account" };

const NEXT_STEP = {
  0: { icon: Smartphone, title: "Confirm your email", body: "Open the link we sent you to activate your account.", href: "/verify-email", cta: "Resend the link" },
  1: { icon: Smartphone, title: "Verify your mobile number", body: "A one-time code by SMS. It unlocks messaging and checkout.", href: "/account/verification?step=phone", cta: "Verify my number" },
  2: { icon: UserRoundCheck, title: "Verify your identity", body: "A government ID and a quick selfie. Required to buy, make offers and chat on the marketplace.", href: "/account/verification?step=identity", cta: "Verify my identity" },
  3: { icon: BadgeCheck, title: "Become a verified seller", body: "Proof of address and a payout account in your own name. Then you can list items.", href: "/account/verification?step=seller", cta: "Start seller checks" },
} as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  // A bad or expired email link lands here with ?error=… from the auth server.
  if (params.error) redirect(`/verify-email?error=${encodeURIComponent(params.error)}`);
  const viewer = await requireViewer("/account");
  await sweepExpired();

  const uid = viewer.userId;
  const [activeListings, openWanted, offersForMe, trades, saved, notes, unread] = await Promise.all([
    db.listing.count({ where: { sellerId: uid, status: { in: ["active", "reserved"] } } }),
    db.buyRequest.count({ where: { buyerId: uid, status: "open" } }),
    db.offer.count({ where: { toUserId: uid, status: "pending", expiresAt: { gt: new Date() } } }),
    db.trade.count({ where: { OR: [{ buyerId: uid }, { sellerId: uid }], status: { in: [...IN_PROGRESS] } } }),
    db.savedListing.count({ where: { userId: uid } }),
    db.notification.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 6 }),
    unreadCounts(uid),
  ]);
  const unreadMessages = [...unread.values()].reduce((a, b) => a + b, 0);
  const firstName = (viewer.profile?.displayName ?? viewer.name).split(" ")[0];
  const step = viewer.tier < 4 ? NEXT_STEP[viewer.tier as 0 | 1 | 2 | 3] : null;

  const tiles = [
    { href: "/account/offers", label: "Offers awaiting you", value: offersForMe, icon: Gavel, urgent: offersForMe > 0 },
    { href: "/account/messages", label: "Unread messages", value: unreadMessages, icon: MessagesSquare, urgent: unreadMessages > 0 },
    { href: "/account/trades", label: "Trades in progress", value: trades, icon: Handshake, urgent: false },
    { href: "/account/listings", label: "Active listings", value: activeListings, icon: Store, urgent: false },
    { href: "/account/wanted", label: "Open wanted posts", value: openWanted, icon: PackageSearch, urgent: false },
    { href: "/account/saved", label: "Saved items", value: saved, icon: Heart, urgent: false },
  ];

  return (
    <div className="grid gap-6">
      {params.welcome ? (
        <Card className="surface-velvet overflow-hidden">
          <CardBody className="flex flex-col items-center gap-4 py-10 text-center sm:flex-row sm:text-left">
            <Emblem animate title="" className="size-24 shrink-0" />
            <div>
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-success sm:justify-start">
                <CheckCircle2 className="size-4" aria-hidden /> Email confirmed
              </p>
              <h1 className="mt-1 text-3xl">Welcome to Luxx4less, {firstName}</h1>
              <p className="mt-2 text-muted">Your account is ready. Real gold, verified people.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div>
          <p className="font-display text-xs tracking-[0.3em] text-champagne uppercase">Your vault</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Good to see you, {firstName}</h1>
        </div>
      )}

      {/* ------------------------------------------ identity + next step */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <CardBody className="grid content-start gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{viewer.profile?.displayName ?? viewer.name}</p>
              <p className="truncate text-sm text-muted">{viewer.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TierBadge tier={viewer.tier} />
              {viewer.roles
                .filter((r) => r !== "buyer")
                .map((r) => (
                  <Badge key={r} tone="gold">
                    {r.replace("_", " ")}
                  </Badge>
                ))}
              {viewer.twoFactorEnabled ? (
                <Badge tone="success" icon={<ShieldCheck aria-hidden />}>
                  Two-step sign-in on
                </Badge>
              ) : (
                <Badge tone="warning">Two-step sign-in off</Badge>
              )}
            </div>
            {viewer.profile?.handle && (
              <Link href={`/sellers/${viewer.profile.handle}`} className="w-fit text-sm font-semibold text-champagne underline-offset-4 hover:underline">
                View my showroom
              </Link>
            )}
          </CardBody>
          <div className="border-t border-line bg-[linear-gradient(135deg,rgb(214_178_110/0.07),transparent_60%)] p-5 sm:p-6 md:border-t-0 md:border-l">
            {step ? (
              <div className="flex gap-4">
                <step.icon className="mt-0.5 size-6 shrink-0 text-ice" aria-hidden />
                <div className="grid gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">Next step</p>
                    <p className="font-semibold text-fg">{step.title}</p>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                  </div>
                  <Button asChild size="sm" className="w-fit rounded-full px-5">
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                </div>
              </div>
            ) : !viewer.twoFactorEnabled ? (
              <div className="grid gap-3">
                <p className="font-semibold text-fg">You&rsquo;re a verified seller</p>
                <p className="text-sm text-muted">Turn on two-step sign-in to start listing: it protects your payouts.</p>
                <Button asChild size="sm" className="w-fit rounded-full px-5">
                  <Link href="/account/security?require2fa=1">Turn on two-step sign-in</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <p className="flex items-center gap-2 font-semibold text-fg">
                  <BadgeCheck className="size-5 text-ice" aria-hidden /> Fully verified
                </p>
                <p className="text-sm text-muted">You can buy, sell, make offers and chat with every verified member.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------ tiles */}
      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="sr-only">
          Summary
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  "group flex h-full flex-col justify-between gap-4 rounded-2xl border bg-surface p-4 transition-colors duration-300 sm:p-5",
                  t.urgent ? "border-champagne/50 bg-gold-tint/30" : "border-line hover:border-champagne/40",
                )}
              >
                <span className="flex items-center justify-between">
                  <t.icon className={cn("size-5", t.urgent ? "text-champagne" : "text-muted group-hover:text-champagne")} aria-hidden />
                  <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-3xl text-fg tabular">{t.value}</span>
                  <span className="text-xs text-muted sm:text-sm">{t.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* ------------------------------------------ recent notifications */}
        <section aria-labelledby="recent-title" className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
              Recent activity
            </h2>
            <Link href="/account/notifications" className="text-sm font-semibold text-muted hover:text-champagne">
              See all
            </Link>
          </div>
          {notes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing yet. Offers, messages and trade updates will appear here as they happen.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {notes.map((n) => (
                <li key={n.id}>
                  <form action={openNotification}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="flex w-full items-start gap-3 py-3 text-left">
                      <span aria-hidden className={cn("mt-2 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-champagne")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", n.readAt ? "text-fg/80" : "font-semibold text-fg")}>{n.title}</span>
                        <span className="block truncate text-xs text-muted">{n.body}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------------------------ quick actions */}
        <section aria-labelledby="quick-title" className="grid content-start gap-3">
          <h2 id="quick-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
            Quick actions
          </h2>
          {[
            { href: "/marketplace/sell", icon: Store, title: "Post a listing", body: viewer.tier >= 4 ? "Photos, price and publish in five steps." : "For verified sellers." },
            { href: "/marketplace/wanted/new", icon: PackageSearch, title: "Post a wanted request", body: "Let sellers with a match come to you." },
            { href: "/prices", icon: LineChart, title: "Check today's prices", body: "Live ₱ per gram for every karat." },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="group flex items-center gap-4 rounded-2xl border border-line p-4 transition-colors hover:border-champagne/45">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne/30 text-champagne">
                <a.icon className="size-[1.1rem]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-fg group-hover:text-champagne">{a.title}</span>
                <span className="block text-sm text-muted">{a.body}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
