"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertTier, requireTier } from "@/lib/server/viewer";
import { findOrCreateConversation, MESSAGE_MAX, storeUserMessage } from "../conversations";
import { runAction, UserError, type ActionState } from "../context";
import { REPORT_HIDE_THRESHOLD } from "../listings";

const Id = z.string().regex(/^[a-z0-9]{20,32}$/i);

/** "Chat with seller" / "Message the buyer": open (or reopen) the conversation about one listing or wanted post. */
export async function startConversation(form: FormData): Promise<void> {
  const back = String(form.get("returnTo") ?? "");
  const viewer = await requireTier(3, /^\/marketplace\/[A-Za-z0-9/-]+$/.test(back) ? back : "/marketplace");
  const listingId = form.get("listingId");
  const buyRequestId = form.get("buyRequestId");
  let other: string;
  let ref: { listingId?: string; buyRequestId?: string };
  if (typeof listingId === "string" && listingId) {
    const l = await db.listing.findUnique({ where: { id: Id.parse(listingId) }, select: { id: true, sellerId: true, status: true, reportCount: true } });
    if (!l || l.status === "removed" || l.reportCount >= REPORT_HIDE_THRESHOLD) throw new Error("This listing is not available.");
    other = l.sellerId;
    ref = { listingId: l.id };
  } else if (typeof buyRequestId === "string" && buyRequestId) {
    const r = await db.buyRequest.findUnique({ where: { id: Id.parse(buyRequestId) }, select: { id: true, buyerId: true, status: true } });
    if (!r || r.status === "removed") throw new Error("This wanted post is not available.");
    other = r.buyerId;
    ref = { buyRequestId: r.id };
  } else {
    throw new Error("Nothing to talk about.");
  }
  if (other === viewer.userId) redirect("/account/messages");
  const id = await findOrCreateConversation({ a: viewer.userId, b: other, ...ref });
  redirect(`/account/messages/${id}`);
}

export type SentMessage = { id: string; body: string; flags: string[]; createdAt: string; senderId: string | null; kind: string };

/** Send a chat message. Verified participants only; blocked conversations are closed both ways. */
export async function sendMessage(conversationId: string, body: string): Promise<{ ok: true; message: SentMessage } | { ok: false; error: string }> {
  const res = await runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    const id = Id.parse(conversationId);
    const text = z.string().trim().min(1, "Write a message first.").max(MESSAGE_MAX, `Keep messages under ${MESSAGE_MAX} characters.`).parse(body);
    const parts = await db.conversationParticipant.findMany({ where: { conversationId: id }, select: { userId: true, blockedAt: true } });
    if (!parts.some((p) => p.userId === viewer.userId)) throw new UserError("This conversation isn't yours.");
    if (parts.some((p) => p.blockedAt)) throw new UserError("This conversation is closed because one of you blocked the other.");
    await assertRateLimit(`chat:${viewer.userId}`, 30, 60_000, "You're sending messages very quickly. Please slow down a little.");
    const m = await storeUserMessage(id, viewer.userId, text);
    return { ok: true, message: JSON.stringify({ ...m, createdAt: m.createdAt.toISOString() }) };
  });
  if (!res?.ok) return { ok: false, error: res?.error ?? "Message not sent." };
  return { ok: true, message: JSON.parse(res.message!) as SentMessage };
}

/** Block (or unblock) the other person in one conversation. Either side's block closes it. */
export async function setBlocked(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(1);
    const id = Id.parse(form.get("conversationId"));
    const block = form.get("block") === "1";
    const updated = await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: viewer.userId },
      data: { blockedAt: block ? new Date() : null },
    });
    if (updated.count !== 1) throw new UserError("This conversation isn't yours.");
    refresh();
    return { ok: true, message: block ? "Blocked. Neither of you can send messages here now." : "Unblocked." };
  });
}
