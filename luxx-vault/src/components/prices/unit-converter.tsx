"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { UNITS, type Unit } from "@/lib/market";
import { convertAll, parseAmount } from "@/lib/prices-format";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { maximumSignificantDigits: 7, maximumFractionDigits: n < 1 ? 6 : 4 }).format(n);

/** Troy ounce ↔ gram ↔ kilogram ↔ tola ↔ tael (PARITY P4). */
export function UnitConverter() {
  const [raw, setRaw] = useState("1");
  const [unit, setUnit] = useState<Unit>("ozt");
  const amount = parseAmount(raw);
  const all = amount ? convertAll(amount, unit) : null;

  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Amount" error={raw && !amount ? "Enter a number greater than zero." : null}>
          {(p) => <Input {...p} inputMode="decimal" autoComplete="off" value={raw} onChange={(e) => setRaw(e.target.value)} className="tabular" />}
        </Field>
        <Field label="Unit">
          {(p) => (
            <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5" aria-live="polite">
        {UNITS.map((u) => (
          <div key={u.value} className={u.value === unit ? "bg-gold-tint p-4" : "bg-surface p-4"}>
            <dt className="text-xs text-muted">{u.label}</dt>
            <dd className="tabular mt-1 text-lg font-semibold text-fg">{all ? fmt(all[u.value]) : "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        1 troy ounce = 31.1035 g · 1 tola = 11.6638 g · 1 tael (Hong Kong) = 37.429 g. Precious metals are priced by the troy ounce, which is
        heavier than the everyday (avoirdupois) ounce of 28.35 g.
      </p>
    </div>
  );
}
