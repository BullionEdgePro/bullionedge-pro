import { useId, type SVGProps } from "react";
import { cn } from "@/lib/cn";
import { emblemMarkup, type EmblemDetail } from "./logo-svg";

interface EmblemProps extends Omit<SVGProps<SVGSVGElement>, "dangerouslySetInnerHTML"> {
  /** full = faithful logo, simple = favicon-size, mono = one colour (currentColor). */
  detail?: EmblemDetail;
  frame?: "flat" | "foil";
  /** Frame draws itself in, stones catch the light in turn (off under reduced motion). */
  animate?: boolean;
  title?: string;
}

/** The Luxx4less emblem: eight-point star frame with the diamond-set L. */
export function Emblem({ detail = "full", frame = "flat", animate = false, title = "Luxx4less", className, ...props }: EmblemProps) {
  const id = `lx${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const decorative = title === "";
  return (
    <svg
      viewBox="0 0 200 200"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      className={cn(animate && "lx-animate", className)}
      // Static, build-time artwork from our own generator (no user input).
      dangerouslySetInnerHTML={{ __html: emblemMarkup({ id, detail, frame, animate }) }}
      {...props}
    />
  );
}

/** Emblem + wordmark, as on the Facebook cover (horizontal) or profile picture (stacked). */
export function Lockup({
  layout = "horizontal",
  className,
  emblemClassName,
  tagline = true,
  animate = false,
}: {
  layout?: "horizontal" | "stacked";
  className?: string;
  emblemClassName?: string;
  tagline?: boolean;
  animate?: boolean;
}) {
  const stacked = layout === "stacked";
  return (
    <span className={cn("inline-flex items-center", stacked ? "flex-col gap-3 text-center" : "gap-2.5", className)}>
      <Emblem animate={animate} title="" className={cn(stacked ? "size-40" : "size-10", emblemClassName)} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display font-semibold tracking-[0.04em] text-gold-large", stacked ? "text-4xl" : "text-[1.35em]")}>Luxx4less</span>
        {tagline && (
          <span className={cn("font-display text-gold-large/85", stacked ? "mt-2 text-sm tracking-[0.06em]" : "mt-1 text-[0.5em] tracking-[0.05em]")}>
            Golds and Diamonds Jewelries
          </span>
        )}
      </span>
    </span>
  );
}
