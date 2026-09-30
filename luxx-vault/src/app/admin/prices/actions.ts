"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { QUOTE_STATUSES } from "@/app/sell/schema";
import { assertAdmin, clientIp } from "@/lib/server/b-admin";
import { saveSpreads, type SaveSpreadsResult } from "@/lib/server/b-spreads";
import { setSellQuoteStatus } from "@/lib/server/sell-quotes";

export type SpreadsState = { status: "idle" } | SaveSpreadsResult;

/** Save the buy/sell spreads. Admins only (re-checked here, not just on the page). */
export async function saveSpreadsAction(_prev: SpreadsState, formData: FormData): Promise<SpreadsState> {
  let session;
  try {
    session = await assertAdmin();
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Not allowed.", rowErrors: {} };
  }
  const result = await saveSpreads(session.user.id, (field) => String(formData.get(field) ?? ""), await clientIp());
  if (result.status === "saved" && result.changed) {
    // Every public price surface reads spreads at request time; refresh the pages that are open.
    revalidatePath("/admin/prices");
    revalidatePath("/prices");
  }
  return result;
}

const statusSchema = z.object({ id: z.string().min(1).max(64), status: z.enum(QUOTE_STATUSES) });

/** Move a sell request to another status. Admins only; audited. */
export async function setQuoteStatusAction(formData: FormData): Promise<void> {
  const session = await assertAdmin();
  const parsed = statusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) throw new Error("Unknown request or status.");
  await setSellQuoteStatus(session.user.id, parsed.data.id, parsed.data.status, await clientIp());
  revalidatePath("/admin/prices");
}
