import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { redirect } from "next/navigation";
import { METALS } from "@/config/catalog";
import { getMarket } from "@/lib/server/prices/engine";
import { assertTier, requireTier, type Viewer } from "@/lib/server/viewer";
import type { SpotTable } from "./valuation";

/** Today's pure-metal ₱/g per metal, once per request. */
export const getSpot = cache(async (): Promise<{ spot: SpotTable; delayed: boolean; checkedAt: string | null }> => {
  try {
    const market = await getMarket();
    const spot: SpotTable = {};
    for (const m of METALS) {
      const p = market.metals[m.value];
      if (p && p.phpPerGram > 0) spot[m.value] = p.phpPerGram;
    }
    return { spot, delayed: market.delayed, checkedAt: market.checkedAt };
  } catch {
    return { spot: {}, delayed: true, checkedAt: null };
  }
});

// ------------------------------------------------------------------ action plumbing

/** An error whose message is written for the person using the site. */
export class UserError extends Error {}

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Where the client should go next, when the action doesn't redirect itself. */
  href?: string;
} | null;

/**
 * Runs an action body and turns failures into a message for the form.
 * Framework control flow (redirect, notFound) is re-thrown untouched. Only
 * messages we wrote reach the person; anything else (a database error) is
 * logged and replaced with a generic line.
 */
export async function runAction(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof UserError || (err instanceof Error && err.constructor === Error)) return { ok: false, error: err.message };
    console.error("[marketplace action]", err);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

/** Tier 4 plus two-step sign-in, for anything that sells. Throws for actions. */
export async function assertSeller(): Promise<Viewer> {
  const viewer = await assertTier(4);
  if (!viewer.twoFactorEnabled) throw new UserError("Turn on two-step sign-in in Security before selling.");
  return viewer;
}

/** Page gate for selling: sends people to verification or to switch on 2FA, then back. */
export async function requireSeller(returnTo: string): Promise<Viewer> {
  const viewer = await requireTier(4, returnTo);
  if (!viewer.twoFactorEnabled) redirect(`/account/security?require2fa=1&next=${encodeURIComponent(returnTo)}`);
  return viewer;
}

/** FormData value as a trimmed string ("" when missing). */
export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}
