/**
 * "Sell to Luxx4less" input rules, shared by the form (hints) and the server
 * action (the real check). Pure: no I/O, so it is unit-tested directly.
 */
import { z } from "zod";
import { brand } from "@/config/brand";
import { METAL_VALUES, type Metal } from "@/config/catalog";
import { purityOptions } from "@/lib/prices-format";

/** Branches that take appraisals: the public ones only (an unconfirmed address sends people to a closed door). */
export const SELL_BRANCHES = brand.branches
  .filter((b) => !("confirm" in b && b.confirm))
  .map((b) => ({ value: b.name.split(" ")[0]!.toLowerCase(), label: b.name, address: b.address }));

export const QUOTE_STATUSES = ["new", "contacted", "booked", "bought", "closed"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** PH mobile (09XX…, +63 9XX…, 639XX…) → "+639XXXXXXXXX"; anything else → null. */
export function normalizePhMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  const m = /^(?:\+?63|0)?(9\d{9})$/.exec(digits);
  return m ? `+63${m[1]}` : null;
}

const email = z.email();

/** A way to reach the person: a PH mobile number or an email address, normalised. */
export function parseContact(raw: string): { kind: "mobile" | "email"; value: string } | null {
  const v = raw.trim();
  const mobile = normalizePhMobile(v);
  if (mobile) return { kind: "mobile", value: mobile };
  if (v.length <= 254 && email.safeParse(v).success) return { kind: "email", value: v.toLowerCase() };
  return null;
}

const DAY_MS = 86_400_000;

/** yyyy-mm-dd in Manila, so "today" matches the shop's calendar. */
export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function sellQuoteSchema(now = new Date()) {
  const today = manilaToday(now);
  const latest = manilaToday(new Date(now.getTime() + 90 * DAY_MS));
  return z
    .object({
      name: z.string().trim().min(2, "Please enter your name.").max(80, "That name is too long."),
      contact: z
        .string()
        .trim()
        .max(254)
        .transform((v, ctx) => {
          const c = parseContact(v);
          if (!c) {
            ctx.addIssue({ code: "custom", message: "Enter a PH mobile number (09XX XXX XXXX) or an email address." });
            return z.NEVER;
          }
          return c.value;
        }),
      metal: z.enum(METAL_VALUES as unknown as [Metal, ...Metal[]], { message: "Choose a metal." }),
      purity: z.coerce.number().int(),
      weightGrams: z.coerce
        .number({ message: "Enter the weight in grams." })
        .positive("Enter the weight in grams.")
        .max(10_000, "For more than 10 kg, please call the shop."),
      branch: z.enum(SELL_BRANCHES.map((b) => b.value) as [string, ...string[]], { message: "Choose a branch." }),
      preferredDate: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : undefined))
        .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date from the calendar.")
        .refine((v) => v === undefined || (v >= today && v <= latest), "Pick a date from today up to 90 days ahead."),
      notes: z
        .string()
        .trim()
        .max(1000, "Please keep notes under 1,000 characters.")
        .optional()
        .transform((v) => (v ? v : undefined)),
    })
    .superRefine((v, ctx) => {
      if (!purityOptions(v.metal).some((o) => o.value === v.purity)) {
        ctx.addIssue({ code: "custom", path: ["purity"], message: v.metal === "gold" ? "Choose a karat." : "Choose a fineness." });
      }
    });
}

export type SellQuoteInput = z.infer<ReturnType<typeof sellQuoteSchema>>;

/** What the form shows after submitting. Field errors are keyed by input name. */
export type SellQuoteState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<keyof SellQuoteInput, string>> }
  | { status: "sent"; branch: string; firstName: string };
