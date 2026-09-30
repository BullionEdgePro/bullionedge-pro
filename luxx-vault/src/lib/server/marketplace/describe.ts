/**
 * How marketplace items and moments are put into words. Pure (no I/O, no
 * server-only), so the same wording serves pages, cards, the trade tape and
 * the browser.
 */
import { CATEGORIES, FORMS, GOLD_TYPES, METALS, labelOf } from "@/config/catalog";

/** Short nouns for the tape and card titles ("chain" reads better than "Necklace or chain"). */
const FORM_NOUN: Record<string, string> = {
  ring: "ring",
  necklace: "necklace",
  bracelet: "bracelet",
  bangle: "bangle",
  earrings: "earrings",
  pendant: "pendant",
  anklet: "anklet",
  bar: "bar",
  coin: "coin",
  loose_stone: "loose stone",
  set: "set",
  scrap: "scrap",
};

export type ItemFacts = {
  category: string;
  metal?: string | null;
  karat?: number | null;
  finenessPermille?: number | null;
  goldType?: string | null;
  form?: string | null;
};

/** "18K", "925 silver", "950 platinum", or "" when there is no metal. */
export function purityLabel(item: Pick<ItemFacts, "metal" | "karat" | "finenessPermille">): string {
  if (item.metal === "gold" && item.karat) return `${item.karat}K`;
  if (item.metal && item.finenessPermille) return `${item.finenessPermille} ${labelOf(METALS, item.metal).toLowerCase()}`;
  if (item.metal === "gold" && item.finenessPermille) return `${item.finenessPermille} gold`;
  return "";
}

/** "18K Saudi necklace", "925 silver bar", "Diamonds loose stone" — an anonymous one-line description. */
export function itemLabel(item: ItemFacts): string {
  const purity = purityLabel(item);
  const origin = item.metal === "gold" && item.goldType && item.goldType !== "other" ? labelOf(GOLD_TYPES, item.goldType).replace(/ gold$/i, "") : "";
  const noun = (item.form && FORM_NOUN[item.form]) || labelOf(FORMS, item.form).toLowerCase() || labelOf(CATEGORIES, item.category).toLowerCase() || "piece";
  const parts = [purity, origin, noun].filter(Boolean);
  const text = parts.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "12.4 g" — one decimal under 100 g, whole grams above. */
export function gramsLabel(grams: number): string {
  if (!(grams > 0)) return "—";
  return grams >= 100 ? `${Math.round(grams).toLocaleString("en-PH")} g` : `${(Math.round(grams * 10) / 10).toFixed(1)} g`;
}

/** "just now", "12 min ago", "2 h ago", "3 d ago", then a date. */
export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const t = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(0, Math.round((now.getTime() - t.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} d ago`;
  return t.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: t.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** Rounded to the nearest ₱10, so a public per-gram figure never reveals an exact total. */
export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

/** "Member since Sep 2026". */
export function monthYear(date: Date): string {
  return date.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}

/** "about 2 hours", "under an hour", "within a day" — typical response time. */
export function responseLabel(ms: number | null): string {
  if (ms === null) return "Not enough chats yet";
  const min = ms / 60_000;
  if (min < 15) return "Within minutes";
  if (min < 60) return "Within an hour";
  if (min < 6 * 60) return "Within a few hours";
  if (min < 24 * 60) return "Within a day";
  return "More than a day";
}
