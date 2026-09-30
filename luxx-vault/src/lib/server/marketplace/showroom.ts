import "server-only";
import { cache } from "react";
import { db } from "@/lib/server/db";
import { PUBLIC_LISTING } from "./listings";

/** A public profile by handle (case-insensitive), or null. */
export const loadShowroom = cache(async (rawHandle: string) => {
  const handle = decodeURIComponent(rawHandle).trim().toLowerCase();
  if (!/^[a-z0-9.-]{2,40}$/.test(handle)) return null;
  const profile = await db.profile.findUnique({
    where: { handle },
    include: { user: { select: { id: true, name: true, banned: true, createdAt: true } } },
  });
  if (!profile || profile.user.banned) return null;
  const listingCount = await db.listing.count({ where: { sellerId: profile.userId, ...PUBLIC_LISTING, expiresAt: { gt: new Date() } } });
  return { profile, listingCount };
});
