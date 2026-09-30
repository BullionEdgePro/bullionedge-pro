import "server-only";
import type { QuoteStatus, SellQuoteInput } from "@/app/sell/schema";
import { SELL_BRANCHES } from "@/app/sell/schema";
import { ADMIN_ROLES, hasAnyRole } from "@/config/roles";
import { METALS, type Metal } from "@/config/catalog";
import { meltValuePhp } from "@/lib/market";
import { fractionFor } from "@/lib/prices-format";
import { audit } from "./audit";
import { db } from "./db";
import { notify } from "./notify";
import { getMarket } from "./prices/engine";

/**
 * "Sell to Luxx4less" quote requests (brief §7 /sell, FEATURES "Sell to us"
 * queue). The estimate is always computed here from the live market, never
 * taken from the form, and it is the melt value: the shop's offer is made
 * after testing, so nothing stored reads as a promised price.
 */

function isMetal(v: string): v is Metal {
  return METALS.some((m) => m.value === v);
}

function purityLabel(metal: string, purity: number | null | undefined) {
  if (purity == null) return "";
  return metal === "gold" ? `${purity}K` : `${purity}`;
}

export async function createSellQuote(input: SellQuoteInput, ctx: { userId: string | null; ip: string }) {
  const market = await getMarket();
  const pure = market.metals[input.metal]?.phpPerGram ?? null;
  const fraction = fractionFor(input.metal, input.purity);
  // 0 means "no price was available when they asked"; the inbox says so.
  const melt = pure && fraction ? meltValuePhp(pure, input.weightGrams, fraction) : 0;

  const quote = await db.sellQuote.create({
    data: {
      userId: ctx.userId,
      name: input.name,
      contact: input.contact,
      metal: input.metal,
      karat: input.metal === "gold" ? input.purity : null,
      finenessPermille: input.metal === "gold" ? null : input.purity,
      weightGrams: input.weightGrams,
      estimatePhp: Math.round(melt * 100) / 100,
      branch: input.branch,
      preferredDate: input.preferredDate ? new Date(`${input.preferredDate}T00:00:00+08:00`) : null,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });

  await audit({
    actorId: ctx.userId,
    action: "sell_quote.create",
    targetType: "sell_quote",
    targetId: quote.id,
    meta: { metal: input.metal, purity: input.purity, weightGrams: input.weightGrams, branch: input.branch },
    ipAddress: ctx.ip,
  });

  // Tell every admin. The contact details stay in the inbox, not in the notification.
  const candidates = await db.user.findMany({ where: { role: { contains: "admin" }, banned: { not: true } }, select: { id: true, role: true } });
  const admins = candidates.filter((u) => hasAnyRole(u.role, ADMIN_ROLES));
  const metalLabel = METALS.find((m) => m.value === input.metal)?.label ?? input.metal;
  const branch = SELL_BRANCHES.find((b) => b.value === input.branch)?.label ?? input.branch;
  await Promise.allSettled(
    admins.map((a) =>
      notify(a.id, {
        kind: "sell_quote",
        title: "New sell request",
        body: `${input.name.split(" ")[0]} wants to sell ${input.weightGrams} g of ${purityLabel(input.metal, input.purity)} ${metalLabel.toLowerCase()} · ${branch}`,
        href: "/admin/prices#quotes",
        channels: ["email"],
      }),
    ),
  );

  return { id: quote.id, branchLabel: branch };
}

export type QuoteRow = {
  id: string;
  name: string;
  contact: string;
  metal: string;
  purityLabel: string;
  purityFraction: number | null;
  weightGrams: number;
  estimatePhp: number;
  branch: string;
  preferredDate: string | null;
  notes: string | null;
  status: QuoteStatus;
  createdAt: string;
  signedIn: boolean;
};

/** Newest first, optionally one status; plus counts per status for the tabs. Admin pages only. */
export async function listSellQuotes(status?: QuoteStatus): Promise<{ rows: QuoteRow[]; counts: Record<string, number> }> {
  const [rows, grouped] = await Promise.all([
    db.sellQuote.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, take: 200 }),
    db.sellQuote.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count._all;
  return {
    counts,
    rows: rows.map((r) => {
      const purity = r.karat ?? r.finenessPermille;
      return {
        id: r.id,
        name: r.name,
        contact: r.contact,
        metal: r.metal,
        purityLabel: purityLabel(r.metal, purity),
        purityFraction: purity != null && isMetal(r.metal) ? fractionFor(r.metal, purity) : null,
        weightGrams: Number(r.weightGrams),
        estimatePhp: Number(r.estimatePhp),
        branch: SELL_BRANCHES.find((b) => b.value === r.branch)?.label ?? r.branch,
        preferredDate: r.preferredDate ? r.preferredDate.toISOString() : null,
        notes: r.notes,
        status: r.status as QuoteStatus,
        createdAt: r.createdAt.toISOString(),
        signedIn: Boolean(r.userId),
      };
    }),
  };
}

/** Move a quote along new → contacted → booked → bought → closed, with an audit entry. */
export async function setSellQuoteStatus(actorId: string, id: string, status: QuoteStatus, ip: string) {
  const existing = await db.sellQuote.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new Error("That request no longer exists.");
  if (existing.status === status) return;
  await db.sellQuote.update({ where: { id }, data: { status } });
  await audit({ actorId, action: "sell_quote.status", targetType: "sell_quote", targetId: id, meta: { from: existing.status, to: status }, ipAddress: ip });
}
