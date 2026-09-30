"use server";

import { clientIp } from "@/lib/server/b-admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { createSellQuote } from "@/lib/server/sell-quotes";
import { getSession } from "@/lib/server/session";
import { sellQuoteSchema, type SellQuoteInput, type SellQuoteState } from "./schema";

const HOUR = 3600_000;

/**
 * Public "sell to us" request. Guests are welcome, so the guard rails are a
 * honeypot, a per-IP rate limit and strict validation. The estimate is worked
 * out on the server from the live market; nothing price-like is read from the form.
 */
export async function requestSellQuote(_prev: SellQuoteState, formData: FormData): Promise<SellQuoteState> {
  // Honeypot: people never see this field; bots fill it. Look successful, store nothing.
  if (String(formData.get("website") ?? "").trim()) {
    return { status: "sent", branch: "", firstName: "" };
  }

  const parsed = sellQuoteSchema().safeParse({
    name: formData.get("name") ?? "",
    contact: formData.get("contact") ?? "",
    metal: formData.get("metal") ?? "",
    purity: formData.get("purity") ?? "",
    weightGrams: formData.get("weightGrams") ?? "",
    branch: formData.get("branch") ?? "",
    preferredDate: formData.get("preferredDate") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof SellQuoteInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof SellQuoteInput | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }

  // Counted only for well-formed requests, so fixing a typo never locks anyone out.
  const ip = await clientIp();
  try {
    await assertRateLimit(`sell-quote:${ip}`, 5, HOUR, "You've sent several requests in the last hour. Please wait a while, or call the shop.");
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Please try again later." };
  }

  const session = await getSession();
  try {
    const { branchLabel } = await createSellQuote(parsed.data, { userId: session?.user.id ?? null, ip });
    return { status: "sent", branch: branchLabel, firstName: parsed.data.name.split(" ")[0] ?? "" };
  } catch (err) {
    console.error("[sell] quote request failed", err);
    return { status: "error", message: "We couldn't send your request just now. Please try again in a minute." };
  }
}
