"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { MAX_ALERTS_PER_USER } from "@/lib/server/alerts/logic";
import { createAlertSchema } from "@/lib/server/alerts/schema";
import { unlink, startLink } from "@/lib/server/channels/link";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { getViewer } from "@/lib/server/viewer";

/**
 * Price-alert mutations. Each one re-checks the session and ownership on the
 * server: the page gate doesn't protect a Server Action, which is reachable
 * by a direct POST.
 */

export type ActionState = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null;

async function signedIn() {
  const viewer = await getViewer();
  // A session only exists after the email is confirmed (Better Auth setting), but check the tier anyway.
  if (!viewer || viewer.tier < 1) throw new Error("Please sign in with a confirmed email first.");
  return viewer;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function createAlert(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const viewer = await signedIn();
    const parsed = createAlertSchema.safeParse({
      metal: formData.get("metal"),
      karat: formData.get("karat") ?? "pure",
      direction: formData.get("direction"),
      target: formData.get("target"),
      channels: formData.getAll("channels"),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
    }
    await assertRateLimit(`alerts:create:${viewer.userId}`, 30, 3600_000, "You've created a lot of alerts in the last hour. Please try again later.");

    const count = await db.priceAlert.count({ where: { userId: viewer.userId } });
    if (count >= MAX_ALERTS_PER_USER) {
      return { ok: false, message: `You can keep up to ${MAX_ALERTS_PER_USER} alerts. Delete one to add another.` };
    }

    // Viber and Messenger only when linked; anything else would silently go nowhere.
    const linked = await db.notificationChannel.findMany({
      where: { userId: viewer.userId, linkedAt: { not: null }, externalId: { not: null } },
      select: { kind: true },
    });
    const linkedKinds = new Set(linked.map((l) => l.kind));
    const channels = parsed.data.channels.filter((c) => c === "in_app" || c === "email" || linkedKinds.has(c));

    await db.priceAlert.create({
      data: {
        userId: viewer.userId,
        metal: parsed.data.metal,
        karat: parsed.data.karat,
        direction: parsed.data.direction,
        targetPhpPerGram: parsed.data.target,
        channels,
      },
    });
    refresh();
    return { ok: true, message: "Alert set. We'll tell you when the price crosses your target." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

const idSchema = z.string().trim().min(1).max(64);

export async function setAlertActive(formData: FormData): Promise<void> {
  const viewer = await signedIn();
  const id = idSchema.parse(formData.get("id"));
  const active = formData.get("active") === "true";
  // Scoped to the owner: another user's id matches nothing.
  await db.priceAlert.updateMany({ where: { id, userId: viewer.userId }, data: { active } });
  refresh();
}

export async function deleteAlert(formData: FormData): Promise<void> {
  const viewer = await signedIn();
  const id = idSchema.parse(formData.get("id"));
  await db.priceAlert.deleteMany({ where: { id, userId: viewer.userId } });
  refresh();
}

const kindSchema = z.enum(["viber", "messenger"]);

export async function connectChannel(kind: string): Promise<{ ok: boolean; mode?: "live" | "mock"; url?: string | null; message: string }> {
  try {
    const viewer = await signedIn();
    const k = kindSchema.parse(kind);
    await assertRateLimit(`channels:link:${viewer.userId}`, 6, 10 * 60_000);
    const result = await startLink(viewer.userId, k, await clientIp());
    refresh();
    const name = k === "viber" ? "Viber" : "Messenger";
    return {
      ok: true,
      ...result,
      message:
        result.mode === "mock"
          ? `${name} linked in test mode with a test id. Messages go to the test outbox, not to ${name}.`
          : `Opening ${name}. Send the prefilled message to finish connecting; this link works once, for 30 minutes.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't start linking. Please try again." };
  }
}

export async function disconnectChannel(formData: FormData): Promise<void> {
  const viewer = await signedIn();
  const k = kindSchema.parse(formData.get("kind"));
  await unlink(viewer.userId, k, await clientIp());
  // Alerts stop asking for a channel that no longer exists.
  const alerts = await db.priceAlert.findMany({ where: { userId: viewer.userId, channels: { has: k } }, select: { id: true, channels: true } });
  await Promise.all(alerts.map((a) => db.priceAlert.update({ where: { id: a.id }, data: { channels: a.channels.filter((c) => c !== k) } })));
  refresh();
}

/** One test message to every channel the person has, so they can see where alerts land. */
export async function sendTestAlert(): Promise<{ ok: boolean; message: string }> {
  try {
    const viewer = await signedIn();
    await assertRateLimit(`alerts:test:${viewer.userId}`, 3, 10 * 60_000, "Test messages are limited to three every ten minutes.");
    const linked = await db.notificationChannel.findMany({
      where: { userId: viewer.userId, linkedAt: { not: null }, externalId: { not: null } },
      select: { kind: true },
    });
    const channels = ["email" as const, ...linked.map((l) => l.kind).filter((k): k is "viber" | "messenger" => k === "viber" || k === "messenger")];
    await notify(viewer.userId, {
      kind: "price_alert",
      title: "Test alert from Luxx4less",
      body: "This is a test. When a real alert fires, it arrives here, with the price and your target.\nNo action needed.",
      href: "/account/alerts",
      channels,
    });
    const note = await db.notification.findFirst({ where: { userId: viewer.userId, kind: "price_alert" }, orderBy: { createdAt: "desc" }, select: { deliveredVia: true } });
    const names: Record<string, string> = { in_app: "the bell", email: "email", viber: "Viber", messenger: "Messenger" };
    refresh();
    return { ok: true, message: `Test delivered to ${(note?.deliveredVia ?? ["in_app"]).map((c) => names[c] ?? c).join(", ")}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't send the test." };
  }
}
