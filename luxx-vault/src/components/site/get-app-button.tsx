"use client";

import { Apple, Download, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

const STANDALONE = "(display-mode: standalone)";

/** True inside the installed app (Android TWA or an iPhone home-screen app): no point offering it there. */
function useInstalled() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(STANDALONE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

/**
 * "Get the app" in the header (owner, 1 Oct 2026). A gold pill whose phone
 * glints now and then; it opens a small panel with a QR code (scan from a
 * computer to land on the download on your phone), the Android download and
 * the iPhone steps. Opens on hover or click, closes on Escape, outside click
 * or leaving it. Hidden when the site is already running as the app.
 */
export function GetAppButton({ qrSvg, androidHref, androidVersion }: { qrSvg: string; androidHref: string; androidVersion: string }) {
  const installed = useInstalled();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (installed) return null;

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  };

  return (
    <div
      ref={root}
      className="relative hidden lg:block"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose();
          setOpen(true);
        }
      }}
      onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Get the Luxx4less app"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "lx-sheen group flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-[border-color,background-color,color] duration-300 xl:px-4",
          open ? "border-champagne bg-gold-tint text-champagne" : "border-champagne/45 text-champagne/90 hover:border-champagne hover:bg-gold-tint",
        )}
      >
        <span className="relative">
          <Smartphone className="size-4.5" aria-hidden />
          {/* A gold glint that catches the phone every few seconds. */}
          <span aria-hidden className="lx-app-glint absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-champagne" />
        </span>
        <span className="hidden xl:inline">Get the app</span>
      </button>

      <div
        id={panelId}
        role="dialog"
        aria-label="Get the Luxx4less app"
        hidden={!open}
        className="absolute top-[calc(100%+0.75rem)] right-0 z-50 w-[22rem] origin-top-right rounded-3xl border border-champagne/30 bg-velvet/95 p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(214_178_110/0.08)] backdrop-blur-xl data-[open=true]:animate-[lx-pop_0.32s_var(--ease-vault)]"
        data-open={open}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl text-fg">Luxx4less in your pocket</p>
            <p className="mt-1 text-xs text-muted">Live gold prices, your trades and alerts, full screen.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4">
          {/* Generated on the server from this site's own address (lib: qrcode). */}
          <div className="rounded-2xl bg-pearl p-2 ring-1 ring-champagne/50" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="text-sm text-fg/85">
            <span className="block font-semibold text-champagne">On a computer?</span>
            Point your phone&apos;s camera at the code to open the download on your phone.
          </p>
        </div>

        <div className="mt-5 grid gap-2">
          <a
            href={androidHref}
            download="Luxx4less.apk"
            className="lx-sheen flex h-11 items-center justify-center gap-2 rounded-full bg-gold-metal text-sm font-semibold text-velvet shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_8px_24px_-12px_#A8823F]"
          >
            <Download className="size-4" aria-hidden /> Download for Android
          </a>
          <Link
            href="/install#how"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-champagne/45 text-sm font-semibold text-champagne transition-colors hover:border-champagne hover:bg-gold-tint"
          >
            <Apple className="size-4" aria-hidden /> iPhone: add from Safari
          </Link>
        </div>
        <p className="mt-3 text-center text-[0.7rem] text-muted">
          Android {androidVersion} · 1.4 MB ·{" "}
          <Link href="/install" onClick={() => setOpen(false)} className="text-gold underline-offset-2 hover:underline">
            all install options
          </Link>
        </p>
      </div>
    </div>
  );
}
