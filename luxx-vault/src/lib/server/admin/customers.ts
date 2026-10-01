import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { parseRoles, verificationTier, STAFF_ROLES, type Role, type Tier } from "@/config/roles";
import { db } from "../db";

/** Staff views of the people using the platform (owner, 1 Oct 2026: "see every buyer and seller"). */

export const CUSTOMER_FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "buyers", label: "Verified buyers" },
  { value: "sellers", label: "Verified sellers" },
  { value: "pending", label: "Waiting for review" },
  { value: "unverified", label: "Not yet verified" },
  { value: "paused", label: "Trading paused" },
  { value: "banned", label: "Banned" },
  { value: "staff", label: "Staff" },
] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number]["value"];

export const PAGE_SIZE = 25;

function whereFor(filter: CustomerFilter, q: string): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  const term = q.trim();
  if (term) {
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { profile: { is: { handle: { contains: term.toLowerCase() } } } },
        { profile: { is: { phone: { contains: term.replace(/\s/g, "") } } } },
      ],
    });
  }
  switch (filter) {
    case "buyers":
      and.push({ profile: { is: { identityVerifiedAt: { not: null } } } });
      break;
    case "sellers":
      and.push({ profile: { is: { sellerVerifiedAt: { not: null } } } });
      break;
    case "pending":
      and.push({ kycSubmissions: { some: { status: "pending" } } });
      break;
    case "unverified":
      and.push({ OR: [{ profile: { is: null } }, { profile: { is: { identityVerifiedAt: null } } }] });
      break;
    case "paused":
      and.push({ profile: { is: { faceLockedAt: { not: null } } } });
      break;
    case "banned":
      and.push({ banned: true });
      break;
    case "staff":
      and.push({ OR: STAFF_ROLES.map((r) => ({ role: { contains: r } })) });
      break;
  }
  return and.length ? { AND: and } : {};
}

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  handle: string | null;
  place: { regionCode: string | null; cityCode: string | null };
  roles: Role[];
  tier: Tier;
  banned: boolean;
  faceLocked: boolean;
  pendingReview: boolean;
  joinedAt: Date;
  lastSeenAt: Date | null;
  activeListings: number;
  purchases: number;
  sales: number;
};

export async function listCustomers({ filter, q, page }: { filter: CustomerFilter; q: string; page: number }) {
  const where = whereFor(filter, q);
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        banned: true,
        createdAt: true,
        profile: {
          select: { handle: true, regionCode: true, cityCode: true, phoneVerifiedAt: true, identityVerifiedAt: true, sellerVerifiedAt: true, faceLockedAt: true },
        },
        sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
        kycSubmissions: { where: { status: "pending" }, take: 1, select: { id: true } },
        _count: { select: { listings: { where: { status: "active" } }, purchases: { where: { status: "released" } }, sales: { where: { status: "released" } } } },
      },
    }),
  ]);
  const rows: CustomerRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    handle: u.profile?.handle ?? null,
    place: { regionCode: u.profile?.regionCode ?? null, cityCode: u.profile?.cityCode ?? null },
    roles: parseRoles(u.role),
    tier: verificationTier({
      signedIn: true,
      emailVerified: u.emailVerified,
      phoneVerified: Boolean(u.profile?.phoneVerifiedAt),
      identityVerified: Boolean(u.profile?.identityVerifiedAt),
      sellerVerified: Boolean(u.profile?.sellerVerifiedAt),
    }),
    banned: Boolean(u.banned),
    faceLocked: Boolean(u.profile?.faceLockedAt),
    pendingReview: u.kycSubmissions.length > 0,
    joinedAt: u.createdAt,
    lastSeenAt: u.sessions[0]?.updatedAt ?? null,
    activeListings: u._count.listings,
    purchases: u._count.purchases,
    sales: u._count.sales,
  }));
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Headline numbers for the staff overview. Money is the sum of released trades only. */
export async function platformStats() {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);
  const monthStart = new Date(new Date().toISOString().slice(0, 7) + "-01T00:00:00+08:00");
  const [
    customers,
    newThisWeek,
    verifiedBuyers,
    verifiedSellers,
    activeListings,
    openWanted,
    tradesInProgress,
    releasedThisMonth,
    pendingKyc,
    openReports,
    openDisputes,
    pausedAccounts,
    newSellQuotes,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.profile.count({ where: { identityVerifiedAt: { not: null } } }),
    db.profile.count({ where: { sellerVerifiedAt: { not: null } } }),
    db.listing.count({ where: { status: "active", expiresAt: { gt: new Date() } } }),
    db.buyRequest.count({ where: { status: "open", expiresAt: { gt: new Date() } } }),
    db.trade.count({ where: { status: { in: ["awaiting_payment", "payment_held", "shipped", "received", "disputed"] } } }),
    db.trade.aggregate({ where: { status: "released", releasedAt: { gte: monthStart } }, _sum: { amountPhp: true }, _count: true }),
    db.kycSubmission.count({ where: { status: "pending" } }),
    db.report.count({ where: { status: "open" } }),
    db.dispute.count({ where: { status: "open" } }),
    db.profile.count({ where: { faceLockedAt: { not: null } } }),
    db.sellQuote.count({ where: { status: "new" } }),
  ]);
  return {
    customers,
    newThisWeek,
    verifiedBuyers,
    verifiedSellers,
    activeListings,
    openWanted,
    tradesInProgress,
    salesThisMonth: { count: releasedThisMonth._count, amountPhp: Number(releasedThisMonth._sum.amountPhp ?? 0) },
    queues: { pendingKyc, openReports, openDisputes, pausedAccounts, newSellQuotes },
  };
}

export async function recentSignups(take = 8) {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, profile: { select: { handle: true } } },
  });
}

/** Everything staff need to understand one person's activity. Never full ID or payout numbers: only the masked values stored. */
export async function customerDetail(id: string) {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      twoFactorEnabled: true,
      createdAt: true,
      profile: true,
      sessions: { orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, updatedAt: true, userAgent: true, ipAddress: true } },
      kycSubmissions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, level: true, status: true, idType: true, idNumberLast4: true, payoutMasked: true, flags: true, decisionReason: true, createdAt: true, reviewedAt: true },
      },
      listings: { orderBy: { createdAt: "desc" }, take: 10, select: { code: true, title: true, status: true, pricePhp: true, pricingMode: true, createdAt: true } },
      buyRequests: { orderBy: { createdAt: "desc" }, take: 10, select: { code: true, title: true, status: true, createdAt: true } },
      purchases: { orderBy: { createdAt: "desc" }, take: 10, select: { code: true, status: true, amountPhp: true, createdAt: true } },
      sales: { orderBy: { createdAt: "desc" }, take: 10, select: { code: true, status: true, amountPhp: true, createdAt: true } },
      faceChecks: { orderBy: { createdAt: "desc" }, take: 5, select: { passed: true, purpose: true, createdAt: true, flags: true } },
      reviewsReceived: { select: { rating: true } },
      _count: { select: { reports: true } },
    },
  });
}

export async function reportsAgainst(userId: string) {
  return db.report.count({ where: { targetType: "user", targetId: userId } });
}
