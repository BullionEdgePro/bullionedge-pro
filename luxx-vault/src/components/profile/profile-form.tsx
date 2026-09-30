"use client";

import { AtSign, Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { checkHandleAction, saveProfileAction, type HandleStatus } from "@/app/account/profile/actions";
import { Button } from "@/components/ui/button";
import { ChipGroup, Field, FormAlert, Input, Select, Textarea } from "@/components/ui/field";
import { LocationPicker } from "@/components/ui/location-picker";
import { EXPERIENCE, SPECIALIZATIONS, TESTING_TOOLS } from "@/config/catalog";
import { cn } from "@/lib/cn";

export type ProfileFormValues = {
  handle: string;
  displayName: string;
  bio: string;
  regionCode: string;
  provinceCode: string;
  cityCode: string;
  businessName: string;
  specializations: string[];
  tools: string[];
  yearsExperience: number | null;
};

const BIO_MAX = 280;

/** Handle field with a debounced availability check against the server. */
function HandleField({ value, onChange, current, error }: { value: string; onChange: (v: string) => void; current: string; error?: string }) {
  // The last answer from the server, remembered with the handle it was for.
  const [result, setResult] = useState<{ handle: string; status: HandleStatus } | null>(null);
  const handle = value.trim().toLowerCase();
  const needsCheck = Boolean(handle) && handle !== current;
  const status = needsCheck && result?.handle === handle ? result.status : null;
  const checking = needsCheck && !status;
  useEffect(() => {
    if (!needsCheck) return;
    let live = true; // a slower answer for an older handle must not land
    const t = setTimeout(async () => {
      const r = await checkHandleAction(handle);
      if (live) setResult({ handle, status: r });
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [handle, needsCheck]);

  const unchanged = value.trim().toLowerCase() === current;
  const message = error ?? (unchanged ? "This is your current handle." : checking ? "Checking…" : status ? (status.ok ? "Available" : status.reason) : "3 to 30 characters: letters, numbers, dots and hyphens.");
  const tone = error || (status && !status.ok && !checking) ? "bad" : status?.ok && !checking ? "good" : "idle";

  return (
    <div className="grid gap-1.5">
      <label htmlFor="handle" className="text-sm font-semibold">
        Handle
      </label>
      <div className="relative">
        <AtSign className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          id="handle"
          name="handle"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
          aria-describedby="handle-status"
          aria-invalid={tone === "bad" || undefined}
          className="pr-11 pl-9"
        />
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2" aria-hidden>
          {checking ? (
            <LoaderCircle className="size-4 animate-spin text-muted" />
          ) : tone === "good" ? (
            <Check className="size-4 text-success" />
          ) : tone === "bad" ? (
            <CircleAlert className="size-4 text-danger" />
          ) : null}
        </span>
      </div>
      <p id="handle-status" aria-live="polite" className={cn("text-xs", tone === "bad" ? "font-medium text-danger" : tone === "good" ? "text-success" : "text-muted")}>
        {message}
      </p>
      <p className="tabular text-xs text-muted">
        Your showroom: <span className="text-fg/90">/sellers/{value.trim().toLowerCase() || "your-handle"}</span>
      </p>
    </div>
  );
}

export function ProfileForm({ initial, isNew }: { initial: ProfileFormValues; isNew: boolean }) {
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => (f.get(k) as string | null) ?? "";
    setError(null);
    setFe({});
    setSaved(false);
    start(async () => {
      const r = await saveProfileAction({
        handle: s("handle"),
        displayName: s("displayName"),
        bio: s("bio"),
        regionCode: s("regionCode"),
        provinceCode: s("provinceCode"),
        cityCode: s("cityCode"),
        businessName: s("businessName"),
        specializations: f.getAll("specializations").map(String),
        tools: f.getAll("tools").map(String),
        yearsExperience: s("yearsExperience") || null,
      });
      if (!r.ok) {
        setError(r.error);
        setFe((r.fieldErrors ?? {}) as Record<string, string>);
        return;
      }
      setHandle(r.handle);
      setSaved(true);
    });
  }

  // noValidate: the location picker marks region as required, but on a profile it
  // is optional. The server validates every field and the errors show inline.
  return (
    <form onSubmit={submit} className="grid gap-8" noValidate>
      {isNew && <FormAlert tone="info">We&apos;ve suggested a handle from your name. Change anything you like, then save to create your profile.</FormAlert>}

      <section className="grid gap-5" aria-labelledby="who-title">
        <h2 id="who-title" className="font-sans text-lg font-semibold">
          Who you are
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <HandleField value={handle} onChange={setHandle} current={initial.handle && !isNew ? initial.handle : ""} error={fe.handle} />
          <Field label="Display name" error={fe.displayName} hint="How your name appears on listings and in chats.">
            {(p) => <Input {...p} name="displayName" defaultValue={initial.displayName} required minLength={2} maxLength={60} autoComplete="nickname" />}
          </Field>
        </div>
        <Field label="Bio" error={fe.bio} hint={`${bio.length} / ${BIO_MAX}`}>
          {(p) => (
            <Textarea
              {...p}
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="What you collect or sell, how long you've been in gold, what buyers can expect from you."
            />
          )}
        </Field>
        <Field label="Business name (optional)" error={fe.businessName} hint="If you sell as a registered business.">
          {(p) => <Input {...p} name="businessName" defaultValue={initial.businessName} maxLength={80} autoComplete="organization" />}
        </Field>
      </section>

      <section className="grid gap-4" aria-labelledby="where-title">
        <div>
          <h2 id="where-title" className="font-sans text-lg font-semibold">
            Where you&apos;re based
          </h2>
          <p className="text-sm text-muted">Buyers see your city and province, never your street address.</p>
        </div>
        <LocationPicker defaultRegion={initial.regionCode} defaultProvince={initial.provinceCode} defaultCity={initial.cityCode} requireCity={false} errors={{ region: fe.regionCode }} />
      </section>

      <section className="grid gap-5" aria-labelledby="craft-title">
        <div>
          <h2 id="craft-title" className="font-sans text-lg font-semibold">
            Your experience
          </h2>
          <p className="text-sm text-muted">Optional. Helps buyers judge who they&apos;re trading with.</p>
        </div>
        <ChipGroup name="specializations" legend="Specialisations" options={SPECIALIZATIONS} defaultValue={initial.specializations} />
        {fe.specializations && <p className="-mt-3 text-sm font-medium text-danger">{fe.specializations}</p>}
        <ChipGroup name="tools" legend="Testing tools you use" options={TESTING_TOOLS} defaultValue={initial.tools} />
        {fe.tools && <p className="-mt-3 text-sm font-medium text-danger">{fe.tools}</p>}
        <div className="max-w-xs">
          <Field label="Years in precious metals" error={fe.yearsExperience}>
            {(p) => (
              <Select {...p} name="yearsExperience" defaultValue={initial.yearsExperience === null ? "" : String(initial.yearsExperience)}>
                <option value="">Prefer not to say</option>
                {EXPERIENCE.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </section>

      {error && <FormAlert>{error}</FormAlert>}
      {saved && <FormAlert tone="success">Profile saved.</FormAlert>}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Button type="submit" className="rounded-full px-7" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Create profile" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
