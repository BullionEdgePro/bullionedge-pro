import type { ReactNode } from "react";
import { Emblem } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

/** An honest empty state: says what's missing and what to do next, never pads with examples. */
export function EmptyState({ title, body, actions, className }: { title: string; body: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-dashed border-champagne/30 px-6 py-12 text-center sm:px-10", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(214_178_110/0.08),transparent_70%)]" />
      <Emblem detail="mono" title="" className="relative mx-auto size-12 text-champagne/50" />
      <h2 className="relative mt-4 text-xl text-fg">{title}</h2>
      <div className="relative mx-auto mt-2 max-w-md text-sm text-muted">{body}</div>
      {actions && <div className="relative mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
