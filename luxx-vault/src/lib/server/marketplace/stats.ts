import "server-only";
import { cache } from "react";
import { verificationTier, type Tier } from "@/config/roles";
import { db } from "@/lib/server/db";
import { medianResponseMs, trustScore, type ChatMessage, type Trust } from "./trust";

export type PersonStats = {
  userId: string;
  tier: Tier;
  memberSince: Date;
  releasedTrades: number;
  releasedSales: number;
  ratingAverage: number | null;
  ratingCount: number;
  medianResponseMs: number | null;
  trust: Trust;
};

/**
 * Trust inputs for a batch of people, from real records only: released
 * trades (either side), disputes on their trades, reviews received, account
 * age, verification and median first-reply time over recent conversations.
 */
export async function statsFor(userIds: readonly string[]): Promise<Map<string, PersonStats>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, PersonStats>();
  if (!ids.length) return out;
  const since = new Date(Date.now() - 180 * 24 * 3600_000);

  const [users, sales, purchases, reviews, disputes, participations] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        createdAt: true,
        emailVerified: true,
        profile: { select: { phoneVerifiedAt: true, identityVerifiedAt: true, sellerVerifiedAt: true } },
      },
    }),
    db.trade.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: "released" }, _count: { _all: true } }),
    db.trade.groupBy({ by: ["buyerId"], where: { buyerId: { in: ids }, status: "released" }, _count: { _all: true } }),
    db.review.groupBy({ by: ["subjectId"], where: { subjectId: { in: ids } }, _avg: { rating: true }, _count: { _all: true } }),
    db.dispute.findMany({
      where: { trade: { OR: [{ sellerId: { in: ids } }, { buyerId: { in: ids } }] } },
      select: { status: true, trade: { select: { buyerId: true, sellerId: true } } },
    }),
    db.conversationParticipant.findMany({
      where: { userId: { in: ids }, conversation: { lastMessageAt: { gte: since } } },
      select: { userId: true, conversationId: true },
      take: 2000,
    }),
  ]);

  const convIds = [...new Set(participations.map((p) => p.conversationId))];
  const messages = convIds.length
    ? await db.message.findMany({
        where: { conversationId: { in: convIds }, createdAt: { gte: since } },
        select: { conversationId: true, senderId: true, kind: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 20_000,
      })
    : [];
  const byConv = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    const list = byConv.get(m.conversationId) ?? [];
    list.push(m);
    byConv.set(m.conversationId, list);
  }

  const now = Date.now();
  for (const u of users) {
    const tier = verificationTier({
      signedIn: true,
      emailVerified: u.emailVerified,
      phoneVerified: Boolean(u.profile?.phoneVerifiedAt),
      identityVerified: Boolean(u.profile?.identityVerifiedAt),
      sellerVerified: Boolean(u.profile?.sellerVerifiedAt),
    });
    const releasedSales = sales.find((s) => s.sellerId === u.id)?._count._all ?? 0;
    const releasedBuys = purchases.find((s) => s.buyerId === u.id)?._count._all ?? 0;
    const r = reviews.find((x) => x.subjectId === u.id);
    const mine = disputes.filter((d) => d.trade.buyerId === u.id || d.trade.sellerId === u.id);
    const lost = mine.filter(
      (d) => (d.status === "resolved_buyer" && d.trade.sellerId === u.id) || (d.status === "resolved_seller" && d.trade.buyerId === u.id),
    ).length;
    const convs = participations.filter((p) => p.userId === u.id).map((p) => byConv.get(p.conversationId) ?? []);
    const response = medianResponseMs(convs, u.id);
    const ratingAverage = r?._avg.rating ?? null;
    const ratingCount = r?._count._all ?? 0;
    const releasedTrades = releasedSales + releasedBuys;
    out.set(u.id, {
      userId: u.id,
      tier,
      memberSince: u.createdAt,
      releasedTrades,
      releasedSales,
      ratingAverage,
      ratingCount,
      medianResponseMs: response,
      trust: trustScore({
        tier,
        releasedTrades,
        disputesLost: lost,
        disputesTotal: mine.length,
        accountAgeDays: (now - u.createdAt.getTime()) / 86_400_000,
        medianResponseMs: response,
        ratingAverage,
        ratingCount,
      }),
    });
  }
  return out;
}

/** One person's stats, deduplicated per request. */
export const statsForOne = cache(async (userId: string): Promise<PersonStats | null> => (await statsFor([userId])).get(userId) ?? null);

/** Released sales as a seller: the count that lifts the new-seller limits. */
export async function releasedSalesCount(userId: string): Promise<number> {
  return db.trade.count({ where: { sellerId: userId, status: "released" } });
}
