import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Handshake } from "lucide-react";
import { InlineAction } from "@/components/marketplace/inline-action";
import { MediaImage } from "@/components/marketplace/media-image";
import { ReportDialog } from "@/components/marketplace/report-dialog";
import { PlatformPaymentNote } from "@/components/marketplace/scam-warning";
import { Thread } from "@/components/marketplace/thread";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/server/media";
import { setBlocked } from "@/lib/server/marketplace/actions/messages";
import { loadThread, markRead, messagesSince } from "@/lib/server/marketplace/threads";
import { TRADE_STATUS_LABEL } from "@/lib/server/marketplace/trades";
import { requireTier } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireTier(3, `/account/messages/${id}`);
  const convo = await loadThread(id, viewer.userId);
  if (!convo) notFound();
  const [messages] = await Promise.all([messagesSince(id), markRead(id, viewer.userId)]);
  const me = convo.participants.find((p) => p.userId === viewer.userId)!;
  const other = convo.participants.find((p) => p.userId !== viewer.userId);
  const otherName = other?.user.profile?.displayName ?? other?.user.name ?? "Member";
  const blocked = convo.participants.some((p) => p.blockedAt);
  const context = convo.listing
    ? { href: `/marketplace/${convo.listing.code}`, code: convo.listing.code, title: convo.listing.title, image: convo.listing.images[0] ? mediaUrl(convo.listing.images[0].mediaId) : null }
    : convo.buyRequest
      ? { href: `/marketplace/wanted/${convo.buyRequest.code}`, code: convo.buyRequest.code, title: convo.buyRequest.title, image: null }
      : null;

  return (
    <div className="grid min-w-0 gap-4">
      <Link href="/account/messages" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-champagne">
        <ChevronLeft className="size-4" aria-hidden /> All messages
      </Link>

      <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface-sunk/40 p-4 sm:p-5">
        <header className="grid gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {context && (
                <Link href={context.href} className="shrink-0 overflow-hidden rounded-xl">
                  <MediaImage src={context.image} alt="" sizes="48px" className="size-12" />
                </Link>
              )}
              <div className="min-w-0">
                <h1 className="truncate font-sans text-lg font-semibold">
                  {other?.user.profile?.handle ? (
                    <Link href={`/sellers/${other.user.profile.handle}`} className="hover:text-champagne">
                      {otherName}
                    </Link>
                  ) : (
                    otherName
                  )}
                </h1>
                {context && (
                  <Link href={context.href} className="block truncate text-xs text-champagne hover:underline">
                    {context.code} · {context.title}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {convo.trade && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/account/trades/${convo.trade.code}`}>
                    <Handshake aria-hidden /> {convo.trade.code} · {TRADE_STATUS_LABEL[convo.trade.status] ?? convo.trade.status}
                  </Link>
                </Button>
              )}
              {other && <ReportDialog targetType="user" targetId={other.userId} subject={otherName} signedIn label="Report" />}
              <InlineAction action={setBlocked} fields={{ conversationId: convo.id, block: me.blockedAt ? "0" : "1" }} confirm={me.blockedAt ? undefined : `Block ${otherName}? Neither of you will be able to send messages here.`}>
                {me.blockedAt ? "Unblock" : "Block"}
              </InlineAction>
            </div>
          </div>
          <PlatformPaymentNote />
        </header>
        <Thread conversationId={convo.id} meId={viewer.userId} otherName={otherName} initial={messages} blocked={blocked} />
      </section>
    </div>
  );
}
