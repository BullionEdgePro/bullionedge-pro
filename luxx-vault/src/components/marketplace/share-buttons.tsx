"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Copy link + Facebook share (the sharer URL only: no Facebook script on our pages). */
export function ShareButtons({ path, className }: { path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const absolute = () => new URL(path, window.location.origin).toString();
  const btn = "inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3.5 text-sm font-semibold text-fg transition-colors hover:border-champagne/60 hover:text-champagne";
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(absolute());
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
          } catch {
            window.prompt("Copy this link", absolute());
          }
        }}
      >
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
      <a
        className={btn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(path)}`}
        onClick={(e) => {
          e.currentTarget.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absolute())}`;
        }}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
        </svg>
        Share on Facebook
      </a>
    </div>
  );
}
