import "server-only";
import { db } from "@/lib/server/db";

export type ThreadMessage = { id: string; body: string; flags: string[]; createdAt: string; senderId: string | null; kind: string };

/** A conversation the viewer takes part in, with its context; null otherwise (no leaking whether it exists). */
export async function loadThread(conversationId: string, userId: string) {
  if (!/^[a-z0-9]{20,32}$/i.test(conversationId)) return null;
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { include: { user: { select: { id: true, name: true, profile: { select: { handle: true, displayName: true } } } } } },
      listing: { select: { id: true, code: true, title: true, status: true, images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } } } },
      buyRequest: { select: { id: true, code: true, title: true, status: true } },
      trade: { select: { code: true, status: true } },
    },
  });
  if (!convo || !convo.participants.some((p) => p.userId === userId)) return null;
  return convo;
}

export async function messagesSince(conversationId: string, after?: Date, take = 200): Promise<ThreadMessage[]> {
  const rows = await db.message.findMany({
    where: { conversationId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take,
    select: { id: true, body: true, flags: true, createdAt: true, senderId: true, kind: true },
  });
  const list = after ? rows : rows.reverse();
  return list.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
}

export async function markRead(conversationId: string, userId: string) {
  await db.conversationParticipant.updateMany({ where: { conversationId, userId }, data: { lastReadAt: new Date() } });
}
