"use client";

import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleSaved } from "@/lib/server/marketplace/actions/listings";
import { cn } from "@/lib/cn";

/** Save / unsave a listing. Guests are sent to sign in. A small burst of gold on save. */
export function SaveButton({
  listingId,
  initialSaved,
  signedIn,
  label,
  variant = "icon",
  className,
}: {
  listingId: string;
  initialSaved: boolean;
  signedIn: boolean;
  label: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const reduce = useReducedMotion();

  const onClick = () => {
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setSaved((s) => !s); // optimistic
    start(async () => {
      const res = await toggleSaved(listingId);
      if ("error" in res) {
        setSaved((s) => !s);
        setError(res.error);
      } else {
        setSaved(res.saved);
        setError(null);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
      title={error ?? undefined}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 transition-colors",
        variant === "icon"
          ? "size-9 rounded-full bg-velvet/70 text-pearl backdrop-blur-sm hover:text-champagne"
          : "h-11 rounded-lg border border-line px-4 text-sm font-semibold text-fg hover:border-champagne/60",
        saved && "text-champagne",
        className,
      )}
    >
      <span className="relative inline-flex">
        <Heart className={cn("size-[1.1rem]", saved && "fill-champagne text-champagne")} aria-hidden />
        {saved && !reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border border-champagne"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </span>
      {variant === "button" && (saved ? "Saved" : "Save")}
    </button>
  );
}
