"use client";

import { Loader2, SendHorizontal, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/lib/server/marketplace/actions/messages";
import type { ThreadMessage } from "@/lib/server/marketplace/threads";
import { detectScam, SCAM_FLAG_COPY } from "@/lib/scam-detect";
import { cn } from "@/lib/cn";
import { ReportDialog } from "./report-dialog";
import { ScamWarning } from "./scam-warning";

const POLL_MS = 5000;
const MAX = 2000;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-PH", { weekday: "short", day: "numeric", month: "short" });
}
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

/**
 * One conversation. New messages arrive by polling every five seconds while
 * the tab is visible. Flagged messages carry a warning for both people, and a
 * draft that looks risky gets a gentle note before it is sent.
 */
export function Thread({
  conversationId,
  meId,
  otherName,
  initial,
  blocked: initialBlocked,
}: {
  conversationId: string;
  meId: string;
  otherName: string;
  initial: ThreadMessage[];
  blocked: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const lastAt = messages.at(-1)?.createdAt;
  const draftFlags = useMemo(() => (draft.trim().length > 6 ? detectScam(draft).flags : []), [draft]);

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useEffect(() => scrollToEnd(false), [scrollToEnd]);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/account/messages/${conversationId}/poll${lastAt ? `?after=${encodeURIComponent(lastAt)}` : ""}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { messages: ThreadMessage[]; blocked: boolean };
        setBlocked(data.blocked);
        if (data.messages.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const fresh = data.messages.filter((m) => !seen.has(m.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        }
      } catch {
        /* offline: try again next tick */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [conversationId, lastAt]);

  const lastId = messages.at(-1)?.id;
  useEffect(() => scrollToEnd(true), [lastId, scrollToEnd]);

  const send = () => {
    const body = draft.trim();
    if (!body || pending) return;
    setError(null);
    start(async () => {
      const res = await sendMessage(conversationId, body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft("");
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    });
  };

  const days = useMemo(() => messages.map((m, i) => (i === 0 || dayLabel(m.createdAt) !== dayLabel(messages[i - 1]!.createdAt) ? dayLabel(m.createdAt) : null)), [messages]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol ref={listRef} className="flex max-h-[62svh] min-h-72 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-1 py-4 sm:px-2" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <li className="m-auto max-w-xs text-center text-sm text-muted">Say hello. Ask about the hallmark, the weight on a scale, or a video of the piece.</li>}
        {messages.map((m, i) => {
          const day = days[i];
          const mine = m.senderId === meId;
          return (
            <li key={m.id} className="grid gap-3">
              {day && (
                <p className="flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.2em] text-muted uppercase">
                  <span aria-hidden className="h-px flex-1 bg-line" />
                  {day}
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </p>
              )}
              {m.kind === "system" ? (
                <div className="mx-auto max-w-md rounded-xl border border-champagne/25 bg-gold-tint/40 px-4 py-2.5 text-center text-xs text-fg/90">
                  <span className="mb-0.5 block font-display text-[0.65rem] tracking-[0.22em] text-champagne uppercase">Luxx4less</span>
                  {m.body}
                </div>
              ) : (
                <div className={cn("group flex flex-col", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words sm:max-w-[75%]",
                      mine ? "rounded-br-md bg-[linear-gradient(135deg,#3a2c24,#2d2230)] text-pearl ring-1 ring-champagne/30" : "rounded-bl-md bg-surface text-fg ring-1 ring-line",
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted">
                    {mine ? "You" : otherName} · {timeLabel(m.createdAt)}
                    {!mine && <ReportDialog targetType="message" targetId={m.id} subject={`A message from ${otherName}`} signedIn variant="icon" label="Report message" className="size-6 opacity-60 group-hover:opacity-100" />}
                  </span>
                  <ScamWarning flags={m.flags} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {blocked ? (
        <p className="rounded-xl border border-line bg-surface-sunk px-4 py-3 text-center text-sm text-muted">This conversation is closed because one of you blocked the other.</p>
      ) : (
        <form
          className="grid gap-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {draftFlags.length > 0 && (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-tint px-3 py-2 text-xs text-fg">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-semibold text-warning">{SCAM_FLAG_COPY[draftFlags[0]!].title}.</strong> If you send it, both of you will see a safety note. Payment must go through the
                protected hold, never directly.
              </span>
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="chat-draft" className="sr-only">
              Message {otherName}
            </label>
            <textarea
              id="chat-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder={`Message ${otherName}…`}
              className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-fg placeholder:text-muted/70 hover:border-gold-large/50 focus-visible:border-ring"
            />
            <button
              type="submit"
              disabled={!draft.trim() || pending}
              className="lx-sheen grid size-12 shrink-0 place-items-center rounded-xl bg-gold-metal text-velvet disabled:opacity-40"
              aria-label="Send message"
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <SendHorizontal className="size-5" aria-hidden />}
            </button>
          </div>
          <div className="flex justify-between text-[0.7rem] text-muted">
            <span>Enter to send · Shift+Enter for a new line</span>
            <span className="tabular">
              {draft.length}/{MAX}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
