import { cn } from "@/lib/cn";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Renders a formatted number where each digit is a vertical reel that rolls
 * to its new value. Screen readers get the plain value; the reels are hidden.
 * Motion is disabled globally under prefers-reduced-motion.
 *
 * Gold text goes on each glyph (`glyphClassName`), never on the whole number:
 * Chrome paints a parent's `background-clip: text` from stale glyph shapes
 * once the reels below it slide and change width, leaving ghost digits behind
 * (seen when switching karats, 1 Oct 2026). Per-glyph clipping has nothing
 * moving underneath it. Pair it with a fixed background attachment so one
 * gradient still sweeps across all the digits.
 */
export function RollingNumber({
  value,
  className,
  glyphClassName,
  digitWidths,
}: {
  value: string;
  className?: string;
  /** Applied to every visible glyph, e.g. the gold gradient. */
  glyphClassName?: string;
  /** Advance width of each digit in em, for proportional-figure fonts. Omit for tabular figures. */
  digitWidths?: Readonly<Record<string, number>>;
}) {
  const chars = [...value];
  return (
    // Clipped to one 1em line: a gradient clipped to text paints every descendant
    // glyph inside the root's box, whatever the reels' own overflow. Line height
    // is inline because tailwind-merge drops `leading-*` when a text size follows.
    <span className={cn("tabular relative inline-flex h-[1em] items-start overflow-hidden", className)} style={{ lineHeight: 1 }}>
      <span className="sr-only">{value}</span>
      {chars.map((ch, i) => {
        const key = `${chars.length - i}`; // keyed from the right so reels stay put as the number grows
        if (!/\d/.test(ch)) {
          return (
            <span key={key + ch} aria-hidden className={cn("inline-block", glyphClassName)}>
              {ch}
            </span>
          );
        }
        const d = Number(ch);
        return (
          <span
            key={key}
            aria-hidden
            className="inline-block h-[1em] overflow-hidden transition-[width] duration-700 ease-(--ease-vault)"
            style={digitWidths ? { width: `${digitWidths[ch]}em` } : undefined}
          >
            <span className="block transition-[margin] duration-700 ease-(--ease-vault)" style={{ marginTop: `${-d}em` }}>
              {DIGITS.map((n) => (
                <span key={n} className={cn("block h-[1em] text-center", glyphClassName)}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
