"use client";

import { BellRing, Mail, MessageCircle, Phone, TrendingDown, TrendingUp } from "lucide-react";
import { useActionState, useMemo, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { purityFromKarat } from "@/lib/market";
import { createAlert, type ActionState } from "./actions";

const METALS = [
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "platinum", label: "Platinum" },
  { value: "palladium", label: "Palladium" },
] as const;
type MetalKey = (typeof METALS)[number]["value"];

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AlertForm({
  prices,
  karats,
  linked,
  remaining,
}: {
  /** Pure-metal ₱ per gram, or null when unknown. */
  prices: Record<MetalKey, number | null>;
  karats: readonly number[];
  linked: { viber: boolean; messenger: boolean };
  remaining: number;
}) {
  const [target, setTarget] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await createAlert(prev, formData);
    // After a successful create, clear the price for the next alert.
    if (result?.ok) setTarget("");
    return result;
  }, null);
  const [metal, setMetal] = useState<MetalKey>("gold");
  const [karat, setKarat] = useState("18");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const purity = metal === "gold" && karat !== "pure" ? purityFromKarat(Number(karat)) : 1;
  const now = prices[metal] != null ? prices[metal]! * purity : null;
  const quick = useMemo(() => (direction === "above" ? [1, 2, 5] : [-1, -2, -5]), [direction]);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  const disabled = remaining <= 0;

  return (
    <form action={action} className="grid gap-6">
      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-1.5 text-sm font-semibold">Metal</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METALS.map((m) => (
            <label key={m.value} className="cursor-pointer">
              <input
                type="radio"
                name="metal"
                value={m.value}
                checked={metal === m.value}
                onChange={() => setMetal(m.value)}
                className="peer sr-only"
              />
              <span className="flex h-11 items-center justify-center rounded-lg border border-line bg-surface text-sm font-semibold text-fg/80 transition-[color,background-color,border-color,box-shadow] duration-300 peer-checked:border-champagne peer-checked:bg-gold-tint peer-checked:text-champagne peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:border-gold-large/60">
                {m.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Purity" error={errors.karat} hint={metal === "gold" ? "Karat prices follow the fineness table on /prices." : "Other metals follow the pure spot price."}>
          {(p) =>
            metal === "gold" ? (
              <Select {...p} name="karat" value={karat} onChange={(e) => setKarat(e.target.value)}>
                {karats.map((k) => (
                  <option key={k} value={String(k)}>
                    {k}K ({(purityFromKarat(k) * 1000).toFixed(0)})
                  </option>
                ))}
                <option value="pure">Pure gold (spot)</option>
              </Select>
            ) : (
              <>
                <Select {...p} disabled value="pure">
                  <option value="pure">Pure {metal} (spot)</option>
                </Select>
                <input type="hidden" name="karat" value="pure" />
              </>
            )
          }
        </Field>

        <fieldset className="grid min-w-0 gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Tell me when it</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "above", label: "Rises above", icon: TrendingUp },
                { value: "below", label: "Falls below", icon: TrendingDown },
              ] as const
            ).map((d) => (
              <label key={d.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value={d.value}
                  checked={direction === d.value}
                  onChange={() => setDirection(d.value)}
                  className="peer sr-only"
                />
                <span className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-semibold text-fg/80 transition-colors duration-300 peer-checked:border-champagne peer-checked:bg-gold-tint peer-checked:text-champagne peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  <d.icon className="size-4" aria-hidden />
                  {d.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <Field
        label="Target price per gram"
        error={errors.target}
        hint={
          <span>
            {now != null ? (
              <>
                Now <strong className="tabular font-semibold text-fg">{peso.format(now)}</strong> per gram at this purity (spot melt, before dealer spread).
              </>
            ) : (
              "Live price unavailable right now; you can still set a target."
            )}
          </span>
        }
      >
        {(p) => (
          <div className="grid gap-2">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-display text-lg text-champagne">
                ₱
              </span>
              <Input
                {...p}
                name="target"
                inputMode="decimal"
                autoComplete="off"
                placeholder={now != null ? now.toFixed(2) : "0.00"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="pl-9 tabular text-lg"
                required
              />
            </div>
            {now != null && (
              <div className="flex flex-wrap gap-2" aria-label="Quick targets">
                {quick.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setTarget((now * (1 + pct / 100)).toFixed(2))}
                    className="h-8 rounded-full border border-line px-3 text-xs font-semibold text-muted tabular transition-colors hover:border-gold-large/60 hover:text-champagne"
                  >
                    {pct > 0 ? "+" : "−"}
                    {Math.abs(pct)}%
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-1.5 text-sm font-semibold">Send it to</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChannelOption icon={BellRing} label="The bell on Luxx4less" note="Always on" checked disabled />
          <ChannelOption icon={Mail} name="channels" value="email" label="Email" defaultChecked />
          <ChannelOption
            icon={Phone}
            name="channels"
            value="viber"
            label="Viber"
            note={linked.viber ? undefined : "Connect Viber below first"}
            disabled={!linked.viber}
            defaultChecked={linked.viber}
          />
          <ChannelOption
            icon={MessageCircle}
            name="channels"
            value="messenger"
            label="Messenger"
            note={linked.messenger ? "Within 24 h of your last message; email otherwise" : "Connect Messenger below first"}
            disabled={!linked.messenger}
          />
        </div>
      </fieldset>

      {state && <FormAlert tone={state.ok ? "success" : "danger"}>{state.message}</FormAlert>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending || disabled} className="w-full sm:w-auto">
          <BellRing aria-hidden />
          {pending ? "Setting…" : "Set alert"}
        </Button>
        <p className="text-sm text-muted">{disabled ? "You've reached the limit of alerts." : `${remaining} left of your allowance.`}</p>
      </div>
    </form>
  );
}

function ChannelOption({
  icon: Icon,
  label,
  note,
  className,
  ...input
}: {
  icon: typeof Mail;
  label: string;
  note?: string;
  className?: string;
} & ComponentProps<"input">) {
  return (
    <label className={cn("group", input.disabled && !input.checked ? "cursor-not-allowed" : "cursor-pointer", className)}>
      <input type="checkbox" className="peer sr-only" {...input} />
      <span className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 transition-colors duration-300 peer-checked:border-champagne/70 peer-checked:bg-gold-tint peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-60">
        <Icon className="size-4 shrink-0 text-champagne" aria-hidden />
        <span className="grid">
          <span className="text-sm font-semibold">{label}</span>
          {note && <span className="text-xs text-muted">{note}</span>}
        </span>
        <span
          aria-hidden
          className="ml-auto grid size-5 place-items-center rounded-full border border-line text-[0.65rem] text-velvet transition-colors group-has-[:checked]:border-champagne group-has-[:checked]:bg-champagne"
        >
          ✓
        </span>
      </span>
    </label>
  );
}
