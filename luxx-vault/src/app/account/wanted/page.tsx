import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { InlineAction } from "@/components/marketplace/inline-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { closeWanted, renewWanted } from "@/lib/server/marketplace/actions/wanted";
import { itemLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { sweepExpired } from "@/lib/server/marketplace/listings";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "My wanted posts" };

const STATUS: Record<string, { label: string; tone: "success" | "gold" | "neutral" | "warning" | "danger" }> = {
  open: { label: "Open", tone: "success" },
  fulfilled: { label: "Found", tone: "gold" },
  closed: { label: "Closed", tone: "neutral" },
  expired: { label: "Expired", tone: "warning" },
  removed: { label: "Removed by staff", tone: "danger" },
};

export default async function MyWantedPage() {
  const viewer = await requireViewer("/account/wanted");
  await sweepExpired();
  const posts = await db.buyRequest.findMany({
    where: { buyerId: viewer.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { offers: true } }, offers: { where: { status: "pending" }, select: { id: true } } },
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">My wanted posts</h1>
          <p className="mt-1 text-sm text-muted">What you&rsquo;re looking for. Sellers with a match are notified when you post.</p>
        </div>
        {viewer.tier >= 3 && (
          <Button asChild className="rounded-full">
            <Link href="/marketplace/wanted/new">
              <Plus aria-hidden /> New wanted post
            </Link>
          </Button>
        )}
      </div>
      {posts.length === 0 ? (
        <EmptyState
          title="No wanted posts yet"
          body={viewer.tier >= 3 ? "Describe the karat, weight and budget you have in mind, and let verified sellers come to you." : "Verify your identity to post what you're looking for."}
          actions={
            <Button asChild className="rounded-full">
              <Link href={viewer.tier >= 3 ? "/marketplace/wanted/new" : "/account/verification?step=identity"}>{viewer.tier >= 3 ? "Post a wanted request" : "Verify my identity"}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4">
          {posts.map((p) => {
            const s = STATUS[p.status] ?? STATUS.closed!;
            return (
              <li key={p.id} className="grid gap-2 rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="font-display text-xs tracking-[0.2em] text-muted tabular">{p.code}</span>
                  {p.offers.length > 0 && <Badge tone="gold">{p.offers.length} awaiting your reply</Badge>}
                </div>
                <Link href={`/marketplace/wanted/${p.code}`} className="font-semibold text-fg hover:text-champagne">
                  {p.title}
                </Link>
                <p className="text-sm text-muted tabular">
                  {itemLabel(p)} · {p.budgetMaxPhp ? `budget up to ${formatPeso(Number(p.budgetMaxPhp))}` : "open budget"} · {p._count.offers} {p._count.offers === 1 ? "offer" : "offers"} · posted {timeAgo(p.createdAt)}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {p.offers.length > 0 && (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/account/offers">Review offers</Link>
                    </Button>
                  )}
                  {["open", "expired"].includes(p.status) && viewer.tier >= 3 && (
                    <InlineAction action={renewWanted} fields={{ code: p.code }}>
                      Renew 30 days
                    </InlineAction>
                  )}
                  {["open", "expired"].includes(p.status) && (
                    <InlineAction action={closeWanted} fields={{ code: p.code }} confirm="Close this wanted post? Pending offers will be declined.">
                      Close
                    </InlineAction>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
