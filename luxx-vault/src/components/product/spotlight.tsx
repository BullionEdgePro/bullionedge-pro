"use client";

import { useRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * A soft gold light that follows the cursor across a product card.
 * Mouse only (no effect on touch); CSS-variable driven so it never re-renders.
 */
export function Spotlight({ className, children, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--sx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--sy", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group/spot relative isolate",
        "after:pointer-events-none after:absolute after:inset-0 after:-z-0 after:rounded-[inherit] after:opacity-0 after:transition-opacity after:duration-300",
        "after:bg-[radial-gradient(420px_circle_at_var(--sx,50%)_var(--sy,50%),rgb(214_178_110/0.16),transparent_60%)]",
        "hover:after:opacity-100 motion-reduce:after:hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
