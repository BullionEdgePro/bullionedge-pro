/**
 * Validation for the Official Shop's product form. Pure (zod only); it shares
 * the metal, purity and pricing rules with marketplace listings.
 */
import { z } from "zod";
import { CATEGORY_VALUES } from "@/config/catalog";
import { DESCRIPTION_MAX, MAX_PHOTOS, TITLE_MAX, TITLE_MIN, normaliseItem, type FieldErrors } from "@/lib/server/marketplace/listing-input";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === "1" || v === true, z.boolean());
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const optionalNumber = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[,₱\s]/g, ""))), z.number().optional());

export const productSchema = z.object({
  photos: z.preprocess(
    (v) => {
      try {
        return typeof v === "string" ? JSON.parse(v) : v;
      } catch {
        return [];
      }
    },
    z.array(z.string().regex(/^[a-z0-9]{20,32}$/i)).max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos.`),
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
  description: z.string().trim().min(20, "Describe the piece in at least 20 characters.").max(DESCRIPTION_MAX),
  hasCertificate: bool,
  pawnable: z.enum(["yes", "no", "unknown"]).default("unknown"),
  stock: z.preprocess((v) => Number(v), z.number().int("Stock is a whole number.").min(0, "Stock can't be negative.").max(10_000)),
  layawayAllowed: bool,
  featured: bool,
  status: z.enum(["draft", "active", "archived"]),
});

export type ProductInput = z.output<typeof productSchema>;

export function parseProductForm(form: FormData): { data: ProductInput } | { errors: FieldErrors } {
  const parsed = productSchema.safeParse(Object.fromEntries(form.entries()));
  const errors: FieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors };
  }
  const d = parsed.data;
  normaliseItem(d, errors);
  if (d.status === "active" && d.photos.length === 0) errors.photos = "Add at least one photo before publishing.";
  if (Object.keys(errors).length) return { errors };
  return { data: d };
}
