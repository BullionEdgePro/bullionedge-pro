import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Trust score as a thin gold dial with the number in the middle: an
 * instrument, not a badge. Plain SVG, no motion.
 */
export function TrustMeter({ score, label, size = 72, className, caption = "Trust score" }: { score: number; label: string; size?: number; className?: string; caption?: string }) {
  const id = `tg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const r = 30;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // a three-quarter dial
  const filled = (Math.max(0, Math.min(100, score)) / 100) * arc * c;
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={`Trust score ${score} out of 100: ${label}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0dba6" />
            <stop offset="0.5" stopColor="#d6b26e" />
            <stop offset="1" stopColor="#a8823f" />
          </linearGradient>
        </defs>
        <g transform="rotate(135 40 40)">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${arc * c} ${c}`} />
          <circle cx="40" cy="40" r={r} fill="none" stroke={`url(#${id})`} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${filled} ${c}`} />
        </g>
        <text x="40" y="47" textAnchor="middle" fill="var(--fg)" style={{ font: "600 20px var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>
          {score}
        </text>
      </svg>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-fg">{label}</p>
        <p className="text-xs text-muted">{caption}</p>
      </div>
    </div>
  );
}
