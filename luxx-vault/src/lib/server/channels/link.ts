import "server-only";
import { audit } from "../audit";
import { db } from "../db";
import { channelConfig, channelMode, type ExternalChannel } from "./config";
import { newLinkCode } from "./signature";

/**
 * Linking a Viber or Messenger account to a Luxx4less user.
 *
 * 1. The signed-in user presses "Connect": we store a one-time `linkCode` on
 *    their NotificationChannel row and open the platform's deep link carrying it.
 * 2. The platform calls our webhook with that code and the person's platform id
 *    (Viber user id / Messenger PSID). We match the code, store the id, set
 *    `linkedAt` and burn the code.
 *
 * In mock mode step 2 happens at once with a test id, and the UI says so.
 */

/** Codes older than this are refused by the webhook (the row's createdAt is refreshed with each new code). */
export const LINK_CODE_TTL_MS = 30 * 60_000;

export type ChannelStatus = {
  kind: ExternalChannel;
  mode: "live" | "mock";
  linked: boolean;
  linkedAt: Date | null;
  /** Messenger only: when the person last wrote to the Page (opens the 24-hour window). */
  lastInboundAt: Date | null;
};

export async function channelStatuses(userId: string): Promise<ChannelStatus[]> {
  const rows = await db.notificationChannel.findMany({ where: { userId } });
  return Promise.all(
    (["viber", "messenger"] as const).map(async (kind) => {
      const row = rows.find((r) => r.kind === kind);
      const linked = Boolean(row?.externalId && row.linkedAt);
      return {
        kind,
        mode: channelMode(kind),
        linked,
        linkedAt: linked ? row!.linkedAt : null,
        lastInboundAt: linked && kind === "messenger" ? await lastInboundAt("messenger", row!.externalId!) : null,
      };
    }),
  );
}

/** The platform deep link that carries a link code. */
export function deepLink(kind: ExternalChannel, code: string): string {
  const c = channelConfig();
  if (kind === "viber") return `viber://pa?chatURI=${encodeURIComponent(c.VIBER_BOT_URI ?? "")}&context=${encodeURIComponent(code)}`;
  return `https://m.me/${encodeURIComponent(c.MESSENGER_PAGE_USERNAME ?? "")}?ref=${encodeURIComponent(code)}`;
}

/**
 * Start (or restart) linking. Live: returns the deep link to open. Mock:
 * links immediately to a test id and returns no link.
 */
export async function startLink(userId: string, kind: ExternalChannel, ip: string | null): Promise<{ mode: "live" | "mock"; url: string | null }> {
  const mode = channelMode(kind);
  const code = newLinkCode();
  if (mode === "mock") {
    const externalId = `test-${kind}-${userId.slice(-8)}`;
    const row = await db.notificationChannel.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, externalId, linkedAt: new Date(), linkCode: null },
      update: { externalId, linkedAt: new Date(), linkCode: null },
    });
    await recordInbound(kind, externalId);
    await audit({ actorId: userId, action: "channel.linked", targetType: "notification_channel", targetId: row.id, meta: { kind, mode }, ipAddress: ip });
    return { mode, url: null };
  }
  // A new code replaces any earlier one; an existing link stays in place until the new one completes.
  await db.notificationChannel.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, linkCode: code },
    update: { linkCode: code, createdAt: new Date() },
  });
  await audit({ actorId: userId, action: "channel.link_started", targetType: "notification_channel", meta: { kind }, ipAddress: ip });
  return { mode, url: deepLink(kind, code) };
}

/**
 * Called by a verified webhook. Returns the linked user's id, or null when the
 * code is unknown, used or expired. One platform id links to one user: linking
 * it elsewhere moves it.
 */
export async function completeLink(kind: ExternalChannel, code: string, externalId: string): Promise<string | null> {
  const row = await db.notificationChannel.findUnique({ where: { linkCode: code } });
  if (!row || row.kind !== kind) return null;
  if (Date.now() - row.createdAt.getTime() > LINK_CODE_TTL_MS) {
    await db.notificationChannel.update({ where: { id: row.id }, data: { linkCode: null } });
    return null;
  }
  const displaced = await db.notificationChannel.findMany({ where: { kind, externalId, NOT: { id: row.id } }, select: { id: true, userId: true } });
  await db.$transaction([
    db.notificationChannel.updateMany({ where: { kind, externalId, NOT: { id: row.id } }, data: { externalId: null, linkedAt: null } }),
    db.notificationChannel.update({ where: { id: row.id }, data: { externalId, linkedAt: new Date(), linkCode: null } }),
  ]);
  await audit({ actorId: row.userId, action: "channel.linked", targetType: "notification_channel", targetId: row.id, meta: { kind, mode: "live" } });
  for (const d of displaced) {
    await audit({ actorId: d.userId, action: "channel.unlinked", targetType: "notification_channel", targetId: d.id, meta: { kind, reason: "linked to another account" } });
  }
  return row.userId;
}

/** The person unlinked us from inside the platform (Viber "unsubscribed"). */
export async function unlinkByExternalId(kind: ExternalChannel, externalId: string, reason: string): Promise<void> {
  const rows = await db.notificationChannel.findMany({ where: { kind, externalId } });
  for (const r of rows) {
    await db.notificationChannel.update({ where: { id: r.id }, data: { externalId: null, linkedAt: null, linkCode: null } });
    await audit({ actorId: r.userId, action: "channel.unlinked", targetType: "notification_channel", targetId: r.id, meta: { kind, reason } });
  }
}

export async function unlink(userId: string, kind: ExternalChannel, ip: string | null): Promise<void> {
  const row = await db.notificationChannel.findUnique({ where: { userId_kind: { userId, kind } } });
  if (!row) return;
  await db.notificationChannel.delete({ where: { id: row.id } });
  await audit({ actorId: userId, action: "channel.unlinked", targetType: "notification_channel", targetId: row.id, meta: { kind, reason: "user" }, ipAddress: ip });
}

/**
 * When the person last wrote to us on a platform. Messenger's 24-hour rule
 * depends on it. The schema has no column for it (see the track report), so
 * it's kept in the generic key/timestamp table the rate limiter uses, under
 * its own "chan:" namespace, where the limiter never looks.
 */
function inboundKey(kind: ExternalChannel, externalId: string) {
  return `chan:inbound:${kind}:${externalId}`;
}

export async function recordInbound(kind: ExternalChannel, externalId: string, at: Date = new Date()): Promise<void> {
  const key = inboundKey(kind, externalId);
  await db.rateLimit.upsert({
    where: { key },
    create: { id: key, key, count: 1, lastRequest: BigInt(at.getTime()) },
    update: { count: { increment: 1 }, lastRequest: BigInt(at.getTime()) },
  });
}

export async function lastInboundAt(kind: ExternalChannel, externalId: string): Promise<Date | null> {
  const row = await db.rateLimit.findUnique({ where: { key: inboundKey(kind, externalId) } });
  return row ? new Date(Number(row.lastRequest)) : null;
}
