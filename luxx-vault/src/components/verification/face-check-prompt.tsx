import Link from "next/link";
import { Lock, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FaceStatus } from "@/lib/server/face/gate";
import { cn } from "@/lib/cn";

/**
 * Shown in place of a gated form when a face check is due (or trading is
 * paused). The server actions enforce the same rule; this only explains it
 * before the person fills anything in.
 */
export function FaceCheckPrompt({ status, className }: { status: Extract<FaceStatus, { state: "required" | "locked" }>; className?: string }) {
  const locked = status.state === "locked";
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center",
        locked ? "border-warning/40 bg-warning-tint" : "border-champagne/30 bg-[linear-gradient(120deg,rgb(214_178_110/0.10),transparent_60%)]",
        className,
      )}
    >
      {locked ? <Lock className="size-6 shrink-0 text-warning" aria-hidden /> : <ScanFace className="size-6 shrink-0 text-champagne" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{locked ? "Trading is paused" : "Confirm it's you"}</p>
        <p className="text-sm text-muted">{status.message}</p>
      </div>
      {!locked && (
        <Button asChild size="sm" className="rounded-full px-5">
          <Link href={status.href}>Start the face check</Link>
        </Button>
      )}
    </div>
  );
}
