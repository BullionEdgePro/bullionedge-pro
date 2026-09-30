import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The visible label every mocked provider must carry (brief §0: never fake
 * security). Amber, bordered, and worded plainly: what didn't happen.
 */
export function TestModeNotice({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div role="note" className={cn("flex gap-3 rounded-xl border border-dashed border-warning/50 bg-warning-tint px-4 py-3.5 text-sm", className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="grid gap-1">
        <p className="font-semibold text-warning">{title}</p>
        <div className="text-fg/85">{children}</div>
      </div>
    </div>
  );
}
