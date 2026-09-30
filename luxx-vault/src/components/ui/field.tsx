"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const inputClass =
  "h-12 w-full rounded-lg border border-line bg-surface px-3.5 text-base text-fg placeholder:text-muted/70 transition-colors hover:border-gold-large/50 focus-visible:border-ring aria-invalid:border-danger disabled:opacity-60";

/** Label + input + hint/error, wired for screen readers (errors are announced). */
export function Field({
  label,
  hint,
  error,
  action,
  children,
  id: idProp,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** A link or button shown beside the label (kept out of the label's accessible name). */
  action?: ReactNode;
  id?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {action}
      </div>
      {children({ id, "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input type={shown ? "text" : "password"} className={cn(inputClass, "pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-md text-muted hover:text-fg"
      >
        {shown ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

export function Checkbox({ label, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={props.id ?? id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line accent-[var(--color-bullion)]"
        {...props}
      />
      <label htmlFor={props.id ?? id} className="cursor-pointer text-sm leading-6 text-fg">
        {label}
      </label>
    </div>
  );
}

/** Four-segment meter under the password field. */
export function StrengthMeter({ score, label, hint }: { score: number; label: string; hint: string }) {
  const tone = score <= 1 ? "bg-danger" : score === 2 ? "bg-warning" : "bg-success";
  return (
    <div aria-live="polite" className="grid gap-1.5">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-colors duration-300", i <= score ? tone : "bg-surface-sunk")} />
        ))}
      </div>
      <p className="text-xs text-muted">
        {label && <strong className="font-semibold text-fg">{label}. </strong>}
        {hint}
      </p>
    </div>
  );
}

export function FormAlert({ tone = "danger", children }: { tone?: "danger" | "success" | "info"; children: ReactNode }) {
  const styles = {
    danger: "border-danger/30 bg-danger-tint text-danger",
    success: "border-success/30 bg-success-tint text-success",
    info: "border-ice-deep/30 bg-ice-tint text-fg dark:border-ice/30",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm font-medium", styles)}>
      {children}
    </div>
  );
}

const selectClass =
  "h-12 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pl-3.5 pr-10 text-base text-fg transition-colors hover:border-gold-large/50 focus-visible:border-ring aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60";
// A champagne chevron, so the native select matches the vault styling.
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d6b26e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

/** Native select (best on phones), styled to the tokens. */
export function Select({ className, style, ...props }: ComponentProps<"select">) {
  return <select className={cn(selectClass, className)} style={{ backgroundImage: chevron, ...style }} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-base text-fg placeholder:text-muted/70 transition-colors hover:border-gold-large/50 focus-visible:border-ring aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Multi-select as toggle chips (specialisations, tools, product types).
 * Each chip is a real checkbox, so it submits with the form under `name`.
 */
export function ChipGroup({
  name,
  options,
  defaultValue = [],
  legend,
  hint,
}: {
  name: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  defaultValue?: readonly string[];
  legend: ReactNode;
  hint?: ReactNode;
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValue.includes(o.value)} className="peer sr-only" />
            <span className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-sm text-fg/85 transition-[color,background-color,border-color,box-shadow] duration-300 peer-checked:border-champagne peer-checked:bg-gold-tint peer-checked:text-champagne peer-checked:shadow-[0_0_0_1px_rgb(214_178_110/0.35),0_6px_18px_-10px_rgb(214_178_110/0.6)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:border-gold-large/60">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}
