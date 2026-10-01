import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { MediaImage } from "@/components/marketplace/media-image";
import { PlatformPaymentNote } from "@/components/marketplace/scam-warning";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { unreadCounts } from "@/lib/server/marketplace/conversations";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { requireTier } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await requireTier(3, "/account/messages");
  const [convos, unread] = await Promise.all([
    db.conversation.findMany({
      where: { participants: { some: { userId: viewer.userId } } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        participants: { include: { user: { select: { id: true, name: true, profile: { select: { displayName: true } } } } } },
        listing: { select: { code: true, title: true, status: true, images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } } } },
        buyRequest: { select: { code: true, title: true } },
        trade: { select: { code: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, flags: true, senderId: true, kind: true } },
      },
    }),
    unreadCounts(viewer.userId),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Messages</h1>
        <PlatformPaymentNote className="mt-2" />
      </div>
      {convos.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Open a listing and choose “Chat with seller”, or ask a buyer about their wanted post. Every chat stays here, on the record."
          actions={
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {convos.map((c) => {
            const other = c.participants.find((p) => p.userId !== viewer.userId);
            const otherName = other?.user.profile?.displayName ?? other?.user.name ?? "Member";
            const n = unread.get(c.id) ?? 0;
            const last = c.messages[0];
            const about = c.trade ? `Trade ${c.trade.code}` : c.listing ? `${c.listing.code} · ${c.listing.title}` : c.buyRequest ? `${c.buyRequest.code} · ${c.buyRequest.title}` : "Conversation";
            const blocked = c.participants.some((p) => p.blockedAt);
            return (
              <li key={c.id}>
                <Link href={`/account/messages/${c.id}`} className={cn("flex items-center gap-4 p-4 transition-colors hover:bg-surface-sunk/60", n > 0 && "bg-gold-tint/20")}>
                  <MediaImage src={c.listing?.images[0] && c.listing.status !== "removed" ? mediaUrl(c.listing.images[0].mediaId) : null} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cn("truncate", n > 0 ? "font-semibold text-fg" : "text-fg/90")}>{otherName}</p>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <p className="truncate text-xs text-champagne/90">{about}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
                      {last?.flags.length ? <ShieldAlert className="size-3.5 shrink-0 text-warning" aria-label="Safety note" /> : null}
                      {blocked ? "Closed" : last ? `${last.kind === "system" ? "Luxx4less: " : last.senderId === viewer.userId ? "You: " : ""}${last.body}` : "No messages yet"}
                    </p>
                  </div>
                  {n > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-champagne px-1.5 text-xs leading-6 font-semibold text-velvet tabular">
                      {n}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
