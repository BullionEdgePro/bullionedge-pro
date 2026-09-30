import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";

/** Shown on every trade screen while payments run on the mock provider. */
export function TestModeNote({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "flex w-fit items-center gap-2 rounded-full border border-warning/35 bg-warning-tint px-3.5 py-1.5 text-xs font-semibold text-warning",
        className,
      )}
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      Test mode: no money moves
    </p>
  );
}
