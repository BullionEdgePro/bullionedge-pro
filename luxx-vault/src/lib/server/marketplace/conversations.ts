import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { detectScam } from "@/lib/scam-detect";

type Tx = Prisma.TransactionClient;

/**
 * The conversation between two people about one listing, wanted post or
 * trade: found if it exists, otherwise created. A trade reuses the chat the
 * two already had about that item, so the history stays in one place.
 */
export async function findOrCreateConversation(
  input: { a: string; b: string; listingId?: string | null; buyRequestId?: string | null; tradeId?: string | null },
  tx: Tx | typeof db = db,
): Promise<string> {
  if (input.tradeId) {
    const byTrade = await tx.conversation.findUnique({ where: { tradeId: input.tradeId }, select: { id: true } });
    if (byTrade) return byTrade.id;
  }
  const existing = await tx.conversation.findFirst({
    where: {
      listingId: input.listingId ?? null,
      buyRequestId: input.buyRequestId ?? null,
      ...(input.tradeId ? { tradeId: null } : {}),
      AND: [{ participants: { some: { userId: input.a } } }, { participants: { some: { userId: input.b } } }],
    },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    if (input.tradeId) await tx.conversation.update({ where: { id: existing.id }, data: { tradeId: input.tradeId } });
    return existing.id;
  }
  const created = await tx.conversation.create({
    data: {
      listingId: input.listingId ?? null,
      buyRequestId: input.buyRequestId ?? null,
      tradeId: input.tradeId ?? null,
      participants: { create: [{ userId: input.a }, { userId: input.b }] },
    },
    select: { id: true },
  });
  return created.id;
}

/** A line from Luxx4less inside a conversation (offer accepted, payment held …). */
export async function systemMessage(conversationId: string, body: string, tx: Tx | typeof db = db) {
  await tx.message.create({ data: { conversationId, kind: "system", body } });
  await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}

export const MESSAGE_MAX = 2000;

/**
 * Store a person's message with its anti-scam flags. The caller has already
 * checked the sender is a verified participant and not blocked.
 */
export async function storeUserMessage(conversationId: string, senderId: string, body: string) {
  const { flags } = detectScam(body);
  const now = new Date();
  const [message, others] = await db.$transaction([
    db.message.create({ data: { conversationId, senderId, kind: "user", body, flags }, select: { id: true, body: true, flags: true, createdAt: true, senderId: true, kind: true } }),
    db.conversationParticipant.findMany({ where: { conversationId, userId: { not: senderId } }, select: { userId: true, lastReadAt: true } }),
    db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    db.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: senderId } }, data: { lastReadAt: now } }),
  ]);
  // One nudge per unread streak, not one per message.
  for (const o of others) {
    const unreadBefore = await db.message.count({
      where: { conversationId, id: { not: message.id }, senderId: { not: o.userId }, createdAt: { gt: o.lastReadAt ?? new Date(0) } },
    });
    if (unreadBefore === 0) {
      await notify(o.userId, { kind: "message", title: "New message", body: body.length > 90 ? `${body.slice(0, 87)}…` : body, href: `/account/messages/${conversationId}` });
    }
  }
  return message;
}

/** Unread messages per conversation for one person. */
export async function unreadCounts(userId: string): Promise<Map<string, number>> {
  const parts = await db.conversationParticipant.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } });
  const out = new Map<string, number>();
  await Promise.all(
    parts.map(async (p) => {
      const n = await db.message.count({
        where: { conversationId: p.conversationId, createdAt: { gt: p.lastReadAt ?? new Date(0) }, OR: [{ senderId: { not: userId } }, { senderId: null }] },
      });
      if (n) out.set(p.conversationId, n);
    }),
  );
  return out;
}
