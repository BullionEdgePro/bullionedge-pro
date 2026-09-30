"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { checkHandleAvailability, updateProfile, type ProfileInput } from "@/lib/server/profile";
import { rateLimit } from "@/lib/server/rate-limit";
import { getViewer } from "@/lib/server/viewer";

export type HandleStatus = { ok: true; handle: string } | { ok: false; reason: string };
export type SaveProfileResult = { ok: true; handle: string } | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ProfileInput, string>> };

/** Live "is this handle free?" check while typing. Read-only, rate-limited per account. */
export async function checkHandleAction(handle: string): Promise<HandleStatus> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "Please sign in again." };
  if (!(await rateLimit(`handle:check:${viewer.userId}`, 60, 60_000))) return { ok: false, reason: "Slow down a little, then try again." };
  return checkHandleAvailability(String(handle ?? "").slice(0, 64), viewer.userId);
}

const text = (max: number) => z.string().max(max * 2).optional().nullable().transform((v) => (v ?? "").trim());
const schema = z.object({
  handle: z.string().max(64),
  displayName: z.string().max(120),
  bio: text(280),
  regionCode: text(12),
  provinceCode: text(12),
  cityCode: text(12),
  businessName: text(80),
  specializations: z.array(z.string().max(60)).max(20),
  tools: z.array(z.string().max(60)).max(20),
  yearsExperience: z.string().max(4).optional().nullable(),
});

export async function saveProfileAction(input: unknown): Promise<SaveProfileResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  if (!(await rateLimit(`profile:save:${viewer.userId}`, 20, 10 * 60_000))) return { ok: false, error: "Too many saves in a row. Please wait a few minutes." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some details couldn't be read. Please check the form." };
  const v = parsed.data;
  const years = v.yearsExperience ? Number(v.yearsExperience) : null;

  const result = await updateProfile(viewer.userId, viewer.name, {
    handle: v.handle,
    displayName: v.displayName,
    bio: v.bio || null,
    regionCode: v.regionCode || null,
    provinceCode: v.provinceCode || null,
    cityCode: v.cityCode || null,
    businessName: v.businessName || null,
    specializations: v.specializations,
    tools: v.tools,
    yearsExperience: years !== null && Number.isInteger(years) ? years : Number.NaN,
  });
  if (!result.ok) return { ok: false, error: "Please check the highlighted details.", fieldErrors: result.errors };

  const h = await headers();
  await audit({
    actorId: viewer.userId,
    action: "profile.updated",
    targetType: "profile",
    targetId: viewer.userId,
    meta: result.handleChanged ? { handleChanged: true, handle: result.profile.handle } : { handleChanged: false },
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  refresh();
  return { ok: true, handle: result.profile.handle };
}
