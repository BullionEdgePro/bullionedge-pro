import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { MessageCircle, Phone } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { anyChannelMocked, channelMode } from "@/lib/server/channels/config";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export const metadata: Metadata = { title: "Test outbox", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function keyMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * What the mock Viber and Messenger adapters would have sent. Exists only
 * while at least one of those channels runs in mock mode; on a public URL it
 * also needs ?key=<MAILBOX_KEY>, like /dev/mailbox.
 */
export default async function OutboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!anyChannelMocked()) notFound();
  const e = env();
  const params = await searchParams;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(e.BETTER_AUTH_URL);
  if (!local && !keyMatches(params.key, e.MAILBOX_KEY)) notFound();

  const channel = params.channel === "viber" || params.channel === "messenger" ? params.channel : undefined;
  const messages = await db.devOutbox.findMany({ where: channel ? { channel } : undefined, orderBy: { createdAt: "desc" }, take: 50 });
  const keyParam = params.key ? `&key=${encodeURIComponent(params.key)}` : "";

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <Emblem title="" className="size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl">Test outbox</h1>
          <p className="text-sm text-muted">Viber and Messenger messages the site would have sent. Real delivery starts once the bot and Page keys are added.</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={channelMode("viber") === "mock" ? "warning" : "success"}>Viber: {channelMode("viber") === "mock" ? "test mode" : "live"}</Badge>
          <Badge tone={channelMode("messenger") === "mock" ? "warning" : "success"}>Messenger: {channelMode("messenger") === "mock" ? "test mode" : "live"}</Badge>
        </div>
      </div>
      <nav aria-label="Filter" className="flex gap-2 text-sm">
        {[
          { v: undefined, l: "All" },
          { v: "viber", l: "Viber" },
          { v: "messenger", l: "Messenger" },
        ].map((f) => (
          <a
            key={f.l}
            href={`/dev/outbox?${f.v ? `channel=${f.v}` : ""}${keyParam}`}
            aria-current={channel === f.v ? "page" : undefined}
            className="rounded-full border border-line px-4 py-1.5 font-semibold aria-[current=page]:border-champagne aria-[current=page]:text-champagne"
          >
            {f.l}
          </a>
        ))}
      </nav>
      {messages.length === 0 && <p className="text-muted">No messages yet.</p>}
      <ul className="grid gap-3">
        {messages.map((m) => (
          <li key={m.id}>
            <Card>
              <CardBody className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold" data-testid="outbox-channel">
                    {m.channel === "viber" ? <Phone className="size-4 text-champagne" aria-hidden /> : <MessageCircle className="size-4 text-champagne" aria-hidden />}
                    {m.channel === "viber" ? "Viber" : "Messenger"} <span className="font-normal text-muted">to {m.to}</span>
                  </p>
                  <p className="text-xs text-muted">{m.createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
                </div>
                <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface-sunk px-4 py-3 text-sm leading-6" data-testid="outbox-text">
                  {m.text}
                </p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
