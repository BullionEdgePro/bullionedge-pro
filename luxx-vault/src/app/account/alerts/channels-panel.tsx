"use client";

import { Mail, MessageCircle, Phone, Send, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { connectChannel, disconnectChannel, sendTestAlert } from "./actions";

export type ChannelView = {
  kind: "viber" | "messenger";
  mode: "live" | "mock";
  linked: boolean;
  linkedAt: string | null;
  /** Messenger: end of the 24-hour window, or null when closed. */
  windowOpenUntil: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

const META = {
  viber: { name: "Viber", icon: Phone, blurb: "Alerts arrive as a message from the Luxx4less bot." },
  messenger: { name: "Messenger", icon: MessageCircle, blurb: "Alerts arrive as a message from the Luxx4less Page." },
} as const;

export function ChannelsPanel({ email, channels }: { email: string; channels: ChannelView[] }) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  function connect(kind: "viber" | "messenger") {
    start(async () => {
      const res = await connectChannel(kind);
      setNotice({ ok: res.ok, message: res.message });
      if (res.ok && res.url) {
        // viber:// hands over to the app; m.me opens Messenger (app or web).
        if (kind === "viber") window.location.href = res.url;
        else window.open(res.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  function test() {
    start(async () => setNotice(await sendTestAlert()));
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        <li className="flex items-start gap-4 rounded-xl border border-line bg-surface-sunk/60 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-large/40 bg-gold-tint text-champagne">
            <Mail className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Email</p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
          <Badge tone="success">Ready</Badge>
        </li>

        {channels.map((c) => {
          const m = META[c.kind];
          return (
            <li key={c.kind} className="grid gap-3 rounded-xl border border-line bg-surface-sunk/60 p-4">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-large/40 bg-gold-tint text-champagne">
                  <m.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.name}
                    {c.mode === "mock" && (
                      <Badge tone="warning" title="No Viber/Messenger keys are set; messages go to the test outbox.">
                        Test mode
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {c.linked && c.linkedAt ? `Connected ${fmt(c.linkedAt)}` : m.blurb}
                  </p>
                </div>
                {c.linked ? (
                  <form action={disconnectChannel}>
                    <input type="hidden" name="kind" value={c.kind} />
                    <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label={`Disconnect ${m.name}`}>
                      <Unlink aria-hidden /> Disconnect
                    </Button>
                  </form>
                ) : (
                  <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => connect(c.kind)}>
                    Connect
                  </Button>
                )}
              </div>
              {c.kind === "messenger" && (
                <p className="rounded-lg border border-line/70 px-3 py-2 text-xs leading-5 text-muted">
                  Meta lets a Page message you only within 24 hours of your last message to it.{" "}
                  {c.linked
                    ? c.windowOpenUntil
                      ? `Your window is open until ${fmt(c.windowOpenUntil)}. After that, alerts meant for Messenger come by email until you message the Page again.`
                      : "Your window is closed, so alerts meant for Messenger come by email. Send the Page any message to reopen it for 24 hours."
                    : "Outside that window, alerts meant for Messenger come by email instead."}
                  {c.mode === "mock" && " (Test mode: the window isn't enforced.)"}
                </p>
              )}
              {c.kind === "viber" && c.mode === "live" && !c.linked && (
                <p className="text-xs leading-5 text-muted">Opens Viber on this device. On a computer, Viber Desktop must be installed.</p>
              )}
            </li>
          );
        })}
      </ul>

      {notice && <FormAlert tone={notice.ok ? "success" : "danger"}>{notice.message}</FormAlert>}

      <div>
        <Button type="button" variant="ghost" size="sm" onClick={test} disabled={pending}>
          <Send aria-hidden /> Send a test message
        </Button>
      </div>
    </div>
  );
}
