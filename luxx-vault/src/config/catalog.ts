/**
 * The marketplace vocabulary: what can be listed or wanted, and how it is
 * described. One list feeds the forms, the filters, the database values and
 * the labels, so a category can never be spelled two ways.
 */

export const METALS = [
  { value: "gold", label: "Gold", symbol: "XAU" },
  { value: "silver", label: "Silver", symbol: "XAG" },
  { value: "platinum", label: "Platinum", symbol: "XPT" },
  { value: "palladium", label: "Palladium", symbol: "XPD" },
] as const;
export type Metal = (typeof METALS)[number]["value"];
export const METAL_VALUES = METALS.map((m) => m.value) as unknown as readonly [Metal, ...Metal[]];

export const CATEGORIES = [
  { value: "gold_jewelry", label: "Gold jewellery", metal: "gold" },
  { value: "gold_bullion", label: "Gold bars and coins", metal: "gold" },
  { value: "silver", label: "Silver", metal: "silver" },
  { value: "platinum", label: "Platinum", metal: "platinum" },
  { value: "palladium", label: "Palladium", metal: "palladium" },
  { value: "diamonds", label: "Diamonds", metal: null },
  { value: "gemstones", label: "Gemstones", metal: null },
  { value: "antiques", label: "Antiques with precious metal", metal: null },
  { value: "mixed_lot", label: "Mixed lot", metal: null },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as unknown as readonly [Category, ...Category[]];

/** Gold fineness in parts per thousand. 24K is quoted at 999 (brief §10), not 1000. */
export const GOLD_KARATS = [
  { karat: 24, permille: 999 },
  { karat: 22, permille: 916 },
  { karat: 21, permille: 875 },
  { karat: 20, permille: 833 },
  { karat: 18, permille: 750 },
  { karat: 14, permille: 585 },
  { karat: 10, permille: 417 },
  { karat: 9, permille: 375 },
  { karat: 6, permille: 250 },
] as const;
export type GoldKarat = (typeof GOLD_KARATS)[number]["karat"];

/** Common fineness marks for the other metals. */
export const OTHER_FINENESS: Record<Exclude<Metal, "gold">, readonly number[]> = {
  silver: [999, 958, 925, 900, 800],
  platinum: [999, 950, 900, 850],
  palladium: [999, 950, 500],
};

/** Where Filipino buyers say the gold is from; it changes the price people expect. */
export const GOLD_TYPES = [
  { value: "saudi", label: "Saudi gold" },
  { value: "japan", label: "Japan gold" },
  { value: "italian", label: "Italian gold" },
  { value: "hong_kong", label: "Hong Kong gold" },
  { value: "local", label: "Local (PH) gold" },
  { value: "other", label: "Other or unknown" },
] as const;
export type GoldType = (typeof GOLD_TYPES)[number]["value"];

export const FORMS = [
  { value: "ring", label: "Ring" },
  { value: "necklace", label: "Necklace or chain" },
  { value: "bracelet", label: "Bracelet" },
  { value: "bangle", label: "Bangle" },
  { value: "earrings", label: "Earrings" },
  { value: "pendant", label: "Pendant" },
  { value: "anklet", label: "Anklet" },
  { value: "bar", label: "Bar" },
  { value: "coin", label: "Coin" },
  { value: "loose_stone", label: "Loose stone" },
  { value: "set", label: "Set" },
  { value: "scrap", label: "Scrap or broken" },
  { value: "other", label: "Other" },
] as const;
export type Form = (typeof FORMS)[number]["value"];

/** Buyer and seller profile tags (the reference asks buyers for these at sign-up). */
export const SPECIALIZATIONS = [
  "Gold assaying",
  "Diamond grading",
  "Gemstone identification",
  "Silver testing",
  "Antique jewellery",
  "Coins and bullion",
  "Pawnshop appraisal",
  "Live selling",
] as const;

export const TESTING_TOOLS = [
  "XRF machine",
  "Acid test kit",
  "Electronic gold tester",
  "Loupe or microscope",
  "Diamond tester",
  "Precision scale",
  "Specific-gravity scale",
  "GIA certificate",
] as const;

export const EXPERIENCE = [
  { value: 0, label: "New to precious metals" },
  { value: 1, label: "1–2 years" },
  { value: 3, label: "3–5 years" },
  { value: 6, label: "6–10 years" },
  { value: 11, label: "More than 10 years" },
] as const;

/** How long a listing or a wanted post stays up before it must be renewed. */
export const LISTING_LIFETIME_DAYS = 30;
export const REQUEST_LIFETIME_DAYS = 30;

/** Brand-new sellers are capped until they complete trades (brief §9, cooling-off). */
export const NEW_SELLER_LIMITS = { maxActiveListings: 5, maxListingValuePhp: 150_000, tradesToGraduate: 3 } as const;

/** A listing priced this far below melt value gets a "verify before buying" warning. */
export const BELOW_MELT_WARNING = 0.9;

export function labelOf<T extends { value: string; label: string }>(list: readonly T[], value: string | null | undefined): string {
  return list.find((x) => x.value === value)?.label ?? "";
}
