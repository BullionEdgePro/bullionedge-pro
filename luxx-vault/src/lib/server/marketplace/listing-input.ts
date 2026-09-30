/**
 * Validation for the listing wizard, shared by create and edit. Pure (zod
 * only) so it is unit-tested; the server action adds ownership, limits and
 * live-price checks on top.
 */
import { z } from "zod";
import { CATEGORIES, CATEGORY_VALUES, FORMS, GOLD_KARATS, GOLD_TYPES, OTHER_FINENESS } from "@/config/catalog";

export const TITLE_MIN = 6;
export const TITLE_MAX = 90;
export const DESCRIPTION_MAX = 2000;
export const MAX_PHOTOS = 8;

const bool = z.preprocess((v) => v === "on" || v === "true" || v === "1" || v === true, z.boolean());
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const optionalNumber = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[,₱\s]/g, ""))), z.number().optional());

export const listingSchema = z.object({
  photos: z.preprocess(
    (v) => {
      try {
        return typeof v === "string" ? JSON.parse(v) : v;
      } catch {
        return [];
      }
    },
    z.array(z.string().regex(/^[a-z0-9]{20,32}$/i)).min(1, "Add at least one photo.").max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos.`),
  ),
  title: z.string().trim().min(TITLE_MIN, `Give it a title of at least ${TITLE_MIN} characters.`).max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`),
  category: z.enum(CATEGORY_VALUES, "Choose a category."),
  metal: optionalText,
  karat: optionalNumber,
  finenessPermille: optionalNumber,
  goldType: optionalText,
  form: optionalText,
  weightGrams: z.preprocess((v) => Number(String(v ?? "").replace(/[,\s]/g, "")), z.number("Enter the weight in grams.").min(0.01, "Enter the weight in grams.").max(100_000, "That weight looks too large.")),
  pricingMode: z.enum(["fixed", "spot_premium"]),
  pricePhp: optionalNumber,
  premiumPct: optionalNumber,
  openToOffers: bool,
  description: z.string().trim().min(20, "Describe the piece in at least 20 characters: condition, marks, what's included.").max(DESCRIPTION_MAX),
  hasCertificate: bool,
  hasReceipt: bool,
  pawnable: z.enum(["yes", "no", "unknown"]).default("unknown"),
  regionCode: z.string().regex(/^\d{9,10}$/, "Choose your region."),
  provinceCode: optionalText,
  cityCode: z.string().regex(/^\d{9,10}$/, "Choose your city or municipality."),
  declaration: bool,
  acknowledgeBelowMelt: bool,
});

export type ListingInput = z.output<typeof listingSchema>;
export type FieldErrors = Record<string, string>;

/** Parse the wizard's form data; returns field errors keyed by field name. */
export function parseListingForm(form: FormData, opts: { requireDeclaration: boolean }): { data: ListingInput } | { errors: FieldErrors } {
  const raw = Object.fromEntries(form.entries());
  const parsed = listingSchema.safeParse(raw);
  const errors: FieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors };
  }
  const d = parsed.data;
  const cat = CATEGORIES.find((c) => c.value === d.category)!;
  // A metal category fixes the metal; stones and lots may name one optionally.
  const metal = cat.metal ?? (d.metal && ["gold", "silver", "platinum", "palladium"].includes(d.metal) ? d.metal : undefined);
  d.metal = metal;
  if (metal === "gold") {
    if (!d.karat || !GOLD_KARATS.some((k) => k.karat === d.karat)) errors.karat = "Choose the karat.";
    d.finenessPermille = GOLD_KARATS.find((k) => k.karat === d.karat)?.permille;
    if (d.goldType && !GOLD_TYPES.some((g) => g.value === d.goldType)) errors.goldType = "Choose a gold type.";
  } else {
    d.karat = undefined;
    d.goldType = undefined;
    if (metal) {
      const allowed = OTHER_FINENESS[metal as keyof typeof OTHER_FINENESS];
      if (!d.finenessPermille || !allowed.includes(d.finenessPermille)) errors.finenessPermille = "Choose the fineness.";
    } else {
      d.finenessPermille = undefined;
    }
  }
  if (d.form && !FORMS.some((f) => f.value === d.form)) errors.form = "Choose what it is.";
  if (d.pricingMode === "fixed") {
    if (!d.pricePhp || d.pricePhp < 100 || d.pricePhp > 1_000_000_000) errors.pricePhp = "Enter a price in pesos.";
    d.premiumPct = undefined;
  } else {
    if (!metal || !d.finenessPermille) errors.pricingMode = "Spot-pegged pricing needs a metal and its purity.";
    if (d.premiumPct === undefined || d.premiumPct < -50 || d.premiumPct > 300) errors.premiumPct = "Enter a premium between −50% and 300%.";
    d.pricePhp = undefined;
  }
  if (opts.requireDeclaration && !d.declaration) errors.declaration = "Please confirm you own this item and may sell it.";
  if (Object.keys(errors).length) return { errors };
  return { data: d };
}
