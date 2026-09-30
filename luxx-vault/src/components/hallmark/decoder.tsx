"use client";

import { AlertTriangle, Calculator, CalendarCheck, Delete, Globe2, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { COMMON_STAMPS, decodeHallmarks, type Colour, type HallmarkMetal } from "@/lib/hallmarks";

type Prices = Partial<Record<HallmarkMetal, { phpPerGram: number } | null>>;
type MarketJson = { metals?: Prices; checkedAt?: string; delayed?: boolean };

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLOURS: { value: Colour; label: string; swatch: string }[] = [
  { value: "yellow", label: "Yellow or rose", swatch: "linear-gradient(135deg,#f0dba6,#c9a45e 55%,#b87a5b)" },
  { value: "white", label: "White or silver", swatch: "linear-gradient(135deg,#f4f5f7,#b9bec8 60%,#8d93a0)" },
  { value: "unknown", label: "Not sure", swatch: "conic-gradient(#d6b26e 0 50%,#c9ccd3 0)" },
];

/**
 * Type or tap the marks you can read; see what they claim. The decoding is
 * pure (lib/hallmarks.ts) and runs as you type. The value per gram uses the
 * live spot price from /api/prices.
 */
export function HallmarkDecoder() {
  const [text, setText] = useState("");
  const [colour, setColour] = useState<Colour>("unknown");
  const [market, setMarket] = useState<MarketJson | null>(null);
  const inputId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: MarketJson | null) => !cancelled && setMarket(j))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const d = useMemo(() => decodeHallmarks(text, colour), [text, colour]);
  const pure = d.reading ? market?.metals?.[d.reading.metal]?.phpPerGram ?? null : null;
  const perGram = d.reading && pure ? pure * d.reading.purity : null;

  function tap(stamp: string) {
    setText((t) => (t.trim() ? `${t.trim()} ${stamp}` : stamp));
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold">
          The marks you can see
        </label>
        <div className="relative">
          <input
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 750 ★ 1234 AR, or K18, or 足金"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-14 w-full rounded-xl border border-line bg-surface-sunk px-4 pr-12 font-display text-xl tracking-[0.12em] text-champagne placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-muted/70 focus-visible:border-ring"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText("")}
              aria-label="Clear the marks"
              className="absolute inset-y-0 right-2 my-auto grid size-10 place-items-center rounded-lg text-muted hover:text-fg"
            >
              <Delete className="size-5" aria-hidden />
            </button>
          )}
        </div>
        <p className="text-xs text-muted">Separate marks with spaces. Arabic numerals (٧٥٠) and Chinese characters work too.</p>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold">Or tap what you see</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-7" role="group" aria-label="Common stamps">
          {COMMON_STAMPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => tap(s)}
              aria-label={`Add ${s}`}
              className={cn(
                "grid h-12 place-items-center rounded-lg border border-black/40 px-1 font-display text-[0.95rem] tracking-[0.08em] transition-[transform,box-shadow] duration-200 hover:-translate-y-px active:translate-y-px",
                "bg-[linear-gradient(160deg,#3a2f45_0%,#261d31_45%,#1b1424_100%)] text-[#cdb68a] shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_-1px_0_rgb(0_0_0/0.5),0_6px_14px_-10px_rgb(0_0_0/0.9)]",
                "[text-shadow:0_-1px_0_rgb(0_0_0/0.85),0_1px_0_rgb(255_235_190/0.22)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_0_0_1px_rgb(214_178_110/0.45),0_10px_20px_-12px_rgb(214_178_110/0.6)]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-1 text-sm font-semibold">Colour of the piece</legend>
        <div className="flex flex-wrap gap-2">
          {COLOURS.map((c) => (
            <label key={c.value} className="cursor-pointer">
              <input type="radio" name="colour" value={c.value} checked={colour === c.value} onChange={() => setColour(c.value)} className="peer sr-only" />
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg/85 transition-colors peer-checked:border-champagne peer-checked:bg-gold-tint peer-checked:text-champagne peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                <span aria-hidden className="size-4 rounded-full border border-black/30" style={{ background: c.swatch }} />
                {c.label}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Some numbers mean gold on a yellow piece and silver on a white one.</p>
      </fieldset>

      {/* ------------------------------------------------ reading */}
      <section aria-live="polite" aria-labelledby="reading-title" className="grid gap-4">
        <h2 id="reading-title" className="sr-only">
          What the marks claim
        </h2>
        <div
          className={cn(
            "rounded-2xl border p-5 sm:p-6",
            d.plated ? "border-warning/40 bg-warning-tint" : d.reading ? "border-gold-large/40 bg-[linear-gradient(135deg,rgb(214_178_110/0.12),transparent_60%)]" : "border-line bg-surface",
          )}
        >
          <p className="text-sm font-semibold text-muted">{d.marks.length ? "Reading" : "Waiting for marks"}</p>
          <p className={cn("mt-1 font-display text-xl leading-snug tracking-wide sm:text-2xl", d.plated ? "text-warning" : "text-fg")}>{d.summary}</p>
          {d.reading && (
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-muted">Purity</p>
                <p className="text-gold-metal font-display text-4xl tabular">{(d.reading.purity * 100).toFixed(d.reading.purity >= 0.99 ? 2 : 1)}%</p>
              </div>
              {d.reading.metal === "gold" && d.reading.karat && (
                <div>
                  <p className="text-xs text-muted">Karat</p>
                  <p className="font-display text-4xl text-champagne tabular">{d.reading.karat}K</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted">Metal value per gram, if genuine</p>
                <p className="font-display text-4xl text-fg tabular">{perGram ? peso.format(perGram) : market ? "—" : "…"}</p>
              </div>
            </div>
          )}
          {d.reading && (
            <p className="mt-3 text-xs text-muted">
              Spot melt value of the pure {d.reading.metal} in one gram at this purity{market?.delayed ? " (prices delayed)" : ""}, before any dealer spread or
              workmanship. Shops buy below this and sell above it.
            </p>
          )}
        </div>

        {d.warnings.length > 0 && (
          <ul className="grid gap-2">
            {d.warnings.map((w) => (
              <li key={w} className="flex gap-3 rounded-xl border border-warning/35 bg-warning-tint px-4 py-3 text-sm text-fg">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        )}

        {d.marks.length > 0 && (
          <ol className="grid gap-3">
            {d.marks.map((m, i) => (
              <li key={`${m.input}-${i}`} className="grid gap-2 rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-black/40 bg-[linear-gradient(160deg,#3a2f45,#1b1424)] px-2.5 py-1 font-display text-sm tracking-[0.08em] text-[#cdb68a] [text-shadow:0_-1px_0_rgb(0_0_0/0.85),0_1px_0_rgb(255_235_190/0.22)]">
                    {m.input}
                  </span>
                  <p className="min-w-0 flex-1 font-semibold">{m.title.split(" · ").slice(1).join(" · ") || m.title}</p>
                  <KindBadge kind={m.kind} />
                </div>
                <p className="text-sm leading-6 text-fg/90">{m.meaning}</p>
                {m.notes.map((n) => (
                  <p key={n} className="text-xs leading-5 text-muted">
                    {n}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        )}

        {d.context.length > 0 && (
          <div className="grid gap-2 rounded-xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="size-4 text-champagne" aria-hidden /> What buyers here call it
            </p>
            {d.context.map((c) => (
              <p key={c} className="text-sm leading-6 text-fg/90">
                {c}
              </p>
            ))}
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-line bg-surface-sunk/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldQuestion className="size-4 text-champagne" aria-hidden /> What a stamp does not prove
          </p>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-6 text-muted marker:text-champagne/60">
            {d.doesNotProve.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-4 rounded-2xl border border-gold-large/35 bg-[linear-gradient(120deg,rgb(214_178_110/0.10),transparent_65%)] p-5 sm:p-6">
        <p className="font-display text-xl tracking-wide">A stamp is the maker&apos;s claim, not proof. Test it.</p>
        <p className="text-sm text-muted">
          An acid, electronic or XRF test tells you what the metal really is. Bring the piece in for an appraisal, or estimate its worth first.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/sell">
              <CalendarCheck aria-hidden /> Book an appraisal
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/tools">
              <Calculator aria-hidden /> Gold value calculator
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; tone: "gold" | "neutral" | "warning" | "ice" }> = {
    fineness: { label: "Fineness", tone: "gold" },
    karat: { label: "Karat", tone: "gold" },
    chinese: { label: "Chinese mark", tone: "gold" },
    plated: { label: "Plated", tone: "warning" },
    filled: { label: "Gold filled", tone: "warning" },
    vermeil: { label: "Vermeil", tone: "warning" },
    origin: { label: "Maker / origin", tone: "ice" },
    maker: { label: "Maker's mark", tone: "neutral" },
    unknown: { label: "Unrecognised", tone: "neutral" },
  };
  const b = map[kind] ?? map.unknown!;
  return <Badge tone={b.tone}>{b.label}</Badge>;
}
