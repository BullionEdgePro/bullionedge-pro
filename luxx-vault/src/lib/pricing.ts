/** Precious-metal price maths shared by the hero, /prices and the calculators. */

export const GRAMS_PER_TROY_OUNCE = 31.1035;

/** Purity by karat, as specified in the brief (§10). */
export const KARAT_PURITY = {
  24: 0.999,
  22: 0.916,
  21: 0.875,
  18: 0.75,
  14: 0.585,
  10: 0.417,
} as const;

export type Karat = keyof typeof KARAT_PURITY;
export const KARATS = Object.keys(KARAT_PURITY)
  .map(Number)
  .sort((a, b) => b - a) as Karat[];

/** Pure-metal ₱ per gram from USD per troy ounce and the USD→PHP rate. */
export function phpPerGram(usdPerOz: number, usdPhp: number): number {
  if (!(usdPerOz > 0) || !(usdPhp > 0)) throw new RangeError("Prices must be positive");
  return (usdPerOz * usdPhp) / GRAMS_PER_TROY_OUNCE;
}

/** ₱ per gram of gold at a given karat. */
export function phpPerGramAtKarat(usdPerOz: number, usdPhp: number, karat: Karat): number {
  return phpPerGram(usdPerOz, usdPhp) * KARAT_PURITY[karat];
}

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const pesoCents = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPeso(value: number, cents = false): string {
  return (cents ? pesoCents : peso).format(value);
}
