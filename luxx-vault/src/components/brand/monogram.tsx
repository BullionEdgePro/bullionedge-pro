import { useId, type SVGProps } from "react";
import { MONOGRAMS, type MonogramOption } from "./monogram-data";

type Variant = "gold" | "metal" | "current";

interface MonogramProps extends Omit<SVGProps<SVGSVGElement>, "fill"> {
  option: MonogramOption["id"];
  /** gold = flat champagne, metal = signature gradient, current = inherits text colour. */
  variant?: Variant;
  title?: string;
}

export function Monogram({ option, variant = "gold", title, ...props }: MonogramProps) {
  const o = MONOGRAMS.find((m) => m.id === option)!;
  const uid = useId().replace(/:/g, "");
  const gradId = `mg-${uid}`;
  const maskId = `mk-${uid}`;
  const color = variant === "metal" ? `url(#${gradId})` : variant === "gold" ? "#D6B26E" : "currentColor";
  const knock = [...(o.knockouts ?? []), ...(o.letters.mode === "knockout" ? [o.letters.l, o.letters.v] : [])];

  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={title ?? `Luxx Vault monogram, ${o.name}`} {...props}>
      <defs>
        {variant === "metal" && (
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F0DBA6" />
            <stop offset="0.35" stopColor="#D6B26E" />
            <stop offset="0.7" stopColor="#A8823F" />
            <stop offset="1" stopColor="#D6B26E" />
          </linearGradient>
        )}
        {knock.length > 0 && (
          <mask id={maskId}>
            <rect width="120" height="120" fill="#fff" />
            {knock.map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </mask>
        )}
      </defs>
      <g fill={color} mask={knock.length ? `url(#${maskId})` : undefined}>
        {o.fill.map((d, i) => (
          <path key={i} d={d} fillRule="evenodd" />
        ))}
        {o.letters.mode === "draw" && (
          <>
            <path d={o.letters.l} />
            <path d={o.letters.v} />
          </>
        )}
      </g>
      {o.strokes.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={color} strokeWidth={s.width} />
      ))}
      {o.accents.map((d, i) => (
        <path key={i} d={d} fill="#BFD8E4" />
      ))}
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-display text-[1.35em] leading-none font-semibold tracking-[0.02em]">Luxx Vault</span>
      <span className="ml-2 align-middle text-[0.62em] font-medium tracking-wide text-muted">by Luxx4less</span>
    </span>
  );
}
