/** WCAG 2.x relative luminance and contrast ratio for #RRGGBB colours. */

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => channel(parseInt(h!, 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** AA thresholds: 4.5 for body text, 3 for large text (≥24px, or ≥18.66px bold) and UI parts. */
export type ContrastUse = "text" | "large" | "ui";
export const AA: Record<ContrastUse, number> = { text: 4.5, large: 3, ui: 3 };

export function passesAA(fg: string, bg: string, use: ContrastUse): boolean {
  return contrastRatio(fg, bg) >= AA[use];
}
