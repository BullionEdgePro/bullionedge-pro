import type { Metadata } from "next";
import Link from "next/link";
import { ResolveDisputeForm } from "@/components/marketplace/admin-forms";
import { MediaImage } from "@/components/marketplace/media-image";
import { TestModeNote } from "@/components/marketplace/test-mode-note";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { payments } from "@/lib/server/payments";
import { gramsLabel, itemLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { DISPUTE_REASONS } from "@/lib/server/marketplace/trades";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Disputes" };

export default async function DisputesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["support", "admin", "super_admin"], "/admin/disputes");
  const view = (await searchParams).view === "resolved" ? "resolved" : "open";
  const disputes = await db.dispute.findMany({
    where: view === "open" ? { status: "open" } : { status: { not: "open" } },
    orderBy: { createdAt: view === "open" ? "asc" : "desc" },
    take: 50,
    include: {
      openedBy: { select: { id: true, name: true } },
      trade: {
        include: {
          buyer: { select: { name: true, email: true } },
          seller: { select: { name: true, email: true } },
          conversation: { select: { id: true, messages: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, body: true, senderId: true, kind: true, flags: true, createdAt: true } } } },
        },
      },
    },
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Disputes</h1>
          <p className="mt-1 text-sm text-muted">Read both sides and the evidence, then decide. The note is required, audited, and sent to both people.</p>
        </div>
        {payments().testMode && <TestModeNote />}
      </div>
      <nav className="flex w-fit gap-1 rounded-full border border-line p-1" aria-label="Dispute lists">
        {(["open", "resolved"] as const).map((v) => (
          <Link
            key={v}
            href={v === "open" ? "/admin/disputes" : "/admin/disputes?view=resolved"}
            aria-current={view === v ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view === v ? "bg-gold-tint text-champagne" : "text-muted hover:text-fg")}
          >
            {v === "open" ? "Open" : "Resolved"}
          </Link>
        ))}
      </nav>
      {disputes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{view === "open" ? "No open disputes." : "No resolved disputes yet."}</p>
      ) : (
        <ul className="grid gap-5">
          {disputes.map((d) => {
            const t = d.trade;
            const opener = d.openedBy.id === t.buyerId ? "buyer" : "seller";
            return (
              <li key={d.id} className="grid gap-4 rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={d.status === "open" ? "warning" : "success"}>{d.status.replace("_", " ")}</Badge>
                  <span className="font-display text-xs tracking-[0.2em] text-champagne tabular">{t.code}</span>
                  <span className="text-sm font-semibold">{DISPUTE_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason}</span>
                  <span className="text-xs text-muted">
                    opened by the {opener} ({d.openedBy.name}) {timeAgo(d.createdAt)}
                  </span>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Item</dt>
                    <dd className="text-right">{itemLabel(t)} · {gramsLabel(Number(t.weightGrams))}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Amount held</dt>
                    <dd className="font-semibold tabular">{formatPeso(Number(t.amountPhp))}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Buyer</dt>
                    <dd className="text-right">{t.buyer.name} · {t.buyer.email}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Seller</dt>
                    <dd className="text-right">{t.seller.name} · {t.seller.email}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Fulfilment</dt>
                    <dd className="text-right">{t.fulfilment}{t.courier ? ` · ${t.courier} ${t.trackingNumber}` : ""}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Payment ref</dt>
                    <dd className="truncate text-right text-xs tabular">{t.paymentProvider} · {t.paymentRef ?? "none"}</dd>
                  </div>
                </dl>
                <p className="rounded-xl bg-surface-sunk p-3 text-sm whitespace-pre-line">{d.details}</p>
                {d.evidenceMediaIds.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {d.evidenceMediaIds.map((id) => (
                      <li key={id}>
                        <a href={mediaUrl(id)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                          <MediaImage src={mediaUrl(id)} alt="Evidence photo" isPrivate sizes="96px" className="size-24" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {t.conversation && t.conversation.messages.length > 0 && (
                  <details className="rounded-xl border border-line p-3 text-sm">
                    <summary className="cursor-pointer font-semibold">Latest messages in the trade chat</summary>
                    <ol className="mt-3 grid gap-2">
                      {[...t.conversation.messages].reverse().map((m) => (
                        <li key={m.id} className="text-xs">
                          <span className="font-semibold">{m.kind === "system" ? "Luxx4less" : m.senderId === t.buyerId ? "Buyer" : "Seller"}</span> · {m.createdAt.toLocaleString("en-PH")}
                          {m.flags.length > 0 && <span className="ml-1 text-warning">[{m.flags.join(", ")}]</span>}
                          <p className="text-fg/85">{m.body}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {d.status === "open" ? (
                  <ResolveDisputeForm disputeId={d.id} amount={formatPeso(Number(t.amountPhp))} />
                ) : (
                  <p className="text-sm text-muted">
                    Decided {d.resolvedAt ? timeAgo(d.resolvedAt) : ""}: {d.resolution}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
