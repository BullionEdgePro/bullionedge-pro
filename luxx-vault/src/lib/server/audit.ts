import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

/**
 * Append-only audit trail for security, admin and money-related actions.
 * Never pass secrets, tokens or full ID numbers in `meta`.
 */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      meta: entry.meta,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
