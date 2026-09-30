import type { Metadata } from "next";
import { Bell, CheckCheck, Gavel, Handshake, LineChart, MessagesSquare, PackageSearch, ShieldCheck, Star } from "lucide-react";
import { SubmitButton } from "@/components/marketplace/action-form";
import { EmptyState } from "@/components/marketplace/empty-state";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { markAllNotificationsRead, openNotification } from "@/lib/server/marketplace/actions/account";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, typeof Bell> = {
  offer_received: Gavel,
  offer_accepted: Handshake,
  offer_declined: Gavel,
  message: MessagesSquare,
  trade_update: Handshake,
  price_alert: LineChart,
  kyc_update: ShieldCheck,
  review: Star,
  request_match: PackageSearch,
};

export default async function NotificationsPage() {
  const viewer = await requireViewer("/account/notifications");
  const [notes, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.notification.count({ where: { userId: viewer.userId, readAt: null } }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unread ? `${unread} unread` : "All caught up."}</p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Marking…">
              <CheckCheck aria-hidden /> Mark all read
            </SubmitButton>
          </form>
        )}
      </div>
      {notes.length === 0 ? (
        <EmptyState title="No notifications yet" body="Offers, messages, trade updates, price alerts and verification news will appear here." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {notes.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className={cn("flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-surface-sunk/60", !n.readAt && "bg-gold-tint/20")}>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border", n.readAt ? "border-line text-muted" : "border-champagne/50 text-champagne")}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.readAt ? "text-fg/85" : "font-semibold text-fg")}>
                        {n.title}
                        {!n.readAt && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
