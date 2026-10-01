import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AccountNav } from "@/components/site/account-nav";
import { STAFF_ROLES } from "@/config/roles";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/server/db";
import { requireViewer } from "@/lib/server/viewer";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("/account");
  const [unreadNotes, pendingOffers, ordersToPay] = await Promise.all([
    db.notification.count({ where: { userId: viewer.userId, readAt: null } }),
    db.offer.count({ where: { toUserId: viewer.userId, status: "pending" } }),
    db.shopOrder.count({ where: { buyerId: viewer.userId, status: { in: ["pending_payment", "layaway"] } } }),
  ]);

  return (
    <div className="min-h-svh">
      <SiteHeader signedIn />
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <AccountNav counts={{ "/account/notifications": unreadNotes, "/account/offers": pendingOffers, "/account/orders": ordersToPay }} staff={viewer.roles.some((r) => STAFF_ROLES.includes(r))} />
        </aside>
        <main className="grid min-w-0 content-start gap-6">
          {viewer.tier < 3 && (
            <div className="flex flex-col gap-4 rounded-2xl border border-champagne/30 bg-[linear-gradient(120deg,rgb(214_178_110/0.10),transparent_60%)] p-5 sm:flex-row sm:items-center">
              <ShieldAlert className="size-6 shrink-0 text-champagne" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Identity verification required to trade</p>
                <p className="text-sm text-muted">
                  Verify your mobile number and ID to post listings, send offers and message other traders. It takes about three minutes.
                </p>
              </div>
              <Button asChild size="sm" className="rounded-full px-5">
                <Link href="/account/verification">Start verification</Link>
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
