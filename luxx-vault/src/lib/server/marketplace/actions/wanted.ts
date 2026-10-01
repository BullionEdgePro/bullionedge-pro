"use server";

import { requireFaceForAction } from "@/lib/server/face/gate";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CATEGORIES, CATEGORY_VALUES, FORMS, GOLD_KARATS, GOLD_TYPES, REQUEST_LIFETIME_DAYS } from "@/config/catalog";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertTier } from "@/lib/server/viewer";
import { isValidLocation } from "@/lib/locations";
import { detectScam } from "@/lib/scam-detect";
import { uniqueCode } from "../codes";
import { runAction, UserError, type ActionState } from "../context";
import { itemLabel } from "../describe";

const DAY = 86_400_000;
const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const num = z.preprocess((v) => (blankToUndef(v) === undefined ? undefined : Number(String(v).replace(/[,₱\s]/g, ""))), z.number().positive().optional());

const WantedSchema = z.object({
  title: z.string().trim().min(6, "Give it a title of at least 6 characters.").max(90),
  category: z.enum(CATEGORY_VALUES, "Choose a category."),
  karat: z.preprocess((v) => (blankToUndef(v) === undefined ? undefined : Number(v)), z.number().optional()),
  goldType: z.preprocess(blankToUndef, z.enum(GOLD_TYPES.map((g) => g.value) as [string, ...string[]]).optional()),
  form: z.preprocess(blankToUndef, z.enum(FORMS.map((f) => f.value) as [string, ...string[]]).optional()),
  minGrams: num,
  maxGrams: num,
  budgetMaxPhp: num,
  description: z.string().trim().min(10, "Tell sellers a little more (at least 10 characters).").max(1500),
  regionCode: z.string().regex(/^\d{9,10}$/, "Choose your region."),
  provinceCode: z.preprocess(blankToUndef, z.string().regex(/^\d{9,10}$/).optional()),
  cityCode: z.preprocess(blankToUndef, z.string().regex(/^\d{9,10}$/).optional()),
});

/** Post a wanted request (Tier 3), then tell sellers with matching active listings. */
export async function createWanted(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    await requireFaceForAction("session");
    const parsed = WantedSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Please check the highlighted details.", fieldErrors };
    }
    const d = parsed.data;
    const metal = CATEGORIES.find((c) => c.value === d.category)?.metal ?? null;
    const karat = metal === "gold" && d.karat && GOLD_KARATS.some((k) => k.karat === d.karat) ? d.karat : null;
    if (d.minGrams && d.maxGrams && d.minGrams > d.maxGrams) return { ok: false, fieldErrors: { maxGrams: "The maximum is below the minimum." } };
    if (!isValidLocation(d.regionCode, d.cityCode ?? null, d.provinceCode ?? null)) return { ok: false, fieldErrors: { cityCode: "Choose a city in the selected region." } };
    const scan = detectScam(`${d.title} ${d.description}`);
    if (scan.flags.some((f) => f === "phone_number" || f === "bank_account" || f === "external_link")) {
      return { ok: false, fieldErrors: { description: "Please leave phone numbers, account details and links out. Sellers reach you through Luxx4less chat." } };
    }
    await assertRateLimit(`wanted:create:${viewer.userId}`, 10, DAY, "You've posted several wanted requests today. Please try again tomorrow.");

    const code = await uniqueCode("WP", async (c) => Boolean(await db.buyRequest.findUnique({ where: { code: c }, select: { id: true } })));
    const now = new Date();
    const request = await db.buyRequest.create({
      data: {
        code,
        buyerId: viewer.userId,
        title: d.title,
        category: d.category,
        metal,
        karat,
        goldType: metal === "gold" ? (d.goldType ?? null) : null,
        form: d.form ?? null,
        minGrams: d.minGrams ?? null,
        maxGrams: d.maxGrams ?? null,
        budgetMaxPhp: d.budgetMaxPhp ?? null,
        description: d.description,
        regionCode: d.regionCode,
        provinceCode: d.provinceCode ?? null,
        cityCode: d.cityCode ?? null,
        expiresAt: new Date(now.getTime() + REQUEST_LIFETIME_DAYS * DAY),
      },
      select: { id: true, code: true },
    });

    // Auto-matching: sellers with an active listing in the same category (and karat, when given).
    const sellers = await db.listing.findMany({
      where: { status: "active", category: d.category, ...(karat ? { karat } : {}), sellerId: { not: viewer.userId }, expiresAt: { gt: now } },
      distinct: ["sellerId"],
      select: { sellerId: true },
      take: 50,
    });
    const what = itemLabel({ category: d.category, metal, karat, goldType: d.goldType, form: d.form });
    await Promise.all(
      sellers.map((s) =>
        notify(s.sellerId, { kind: "request_match", title: "A buyer is looking for something you sell", body: `Wanted: ${what}. ${d.title}`, href: `/marketplace/wanted/${request.code}` }),
      ),
    );
    await audit({ actorId: viewer.userId, action: "wanted.created", targetType: "buy_request", targetId: request.id, meta: { code, matched: sellers.length } });
    revalidatePath("/marketplace");
    redirect(`/marketplace/wanted/${request.code}?posted=1&matched=${sellers.length}`);
  });
}

const CodeSchema = z.object({ code: z.string().regex(/^WP-[A-Z0-9]{5}$/) });

async function ownRequest(form: FormData) {
  const viewer = await assertTier(1);
  const { code } = CodeSchema.parse({ code: form.get("code") });
  const r = await db.buyRequest.findUnique({ where: { code }, select: { id: true, buyerId: true, status: true } });
  if (!r || r.buyerId !== viewer.userId) throw new UserError("That wanted post isn't yours.");
  return { viewer, request: r };
}

export async function closeWanted(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, request } = await ownRequest(form);
    if (request.status !== "open" && request.status !== "expired") throw new UserError("This post is no longer open.");
    await db.$transaction([
      db.buyRequest.update({ where: { id: request.id }, data: { status: "closed" } }),
      db.offer.updateMany({ where: { buyRequestId: request.id, status: "pending" }, data: { status: "declined", respondedAt: new Date() } }),
    ]);
    await audit({ actorId: viewer.userId, action: "wanted.closed", targetType: "buy_request", targetId: request.id });
    refresh();
    return { ok: true, message: "Wanted post closed." };
  });
}

export async function renewWanted(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    await assertTier(3);
    const { request } = await ownRequest(form);
    if (request.status !== "open" && request.status !== "expired") throw new UserError("Only open or expired posts can be renewed.");
    await db.buyRequest.update({ where: { id: request.id }, data: { status: "open", expiresAt: new Date(Date.now() + REQUEST_LIFETIME_DAYS * DAY) } });
    refresh();
    return { ok: true, message: `Renewed for ${REQUEST_LIFETIME_DAYS} days.` };
  });
}
