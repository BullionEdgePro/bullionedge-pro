"use client";

import { Camera, ImageUp, RefreshCw, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { drawImage, grabRegion, pixelsOf, useCamera } from "./camera";
import { PROBLEM_ADVICE, assessImage, type QualityReport } from "./image-quality";

export type CapturedSide = { preview: string; report: QualityReport; source: "camera" | "upload" };

/** ID-1 card proportions (85.6 × 54 mm); the guide fills 86% of the view's width. */
const GUIDE = { widthShare: 0.86, aspect: 85.6 / 54, viewAspect: 4 / 3 };
const WORK_WIDTH = 640;
/** Auto-capture once this many consecutive samples pass the quality checks. */
const STEADY_SAMPLES = 3;

/**
 * Photograph one side of an ID inside an on-screen frame. Every photo is
 * checked for blur and glare on this device; nothing is uploaded. Holds
 * still long enough and it takes the photo itself; there's always a
 * shutter button and an upload fallback too.
 */
export function IdCapture({ side, value, onChange }: { side: "front" | "back"; value: CapturedSide | null; onChange: (v: CapturedSide | null) => void }) {
  const cam = useCamera("environment");
  const [error, setError] = useState<string | null>(null);
  const [steady, setSteady] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { state, videoRef, stop, start } = cam;

  function accept(canvas: HTMLCanvasElement, source: "camera" | "upload") {
    const report = assessImage(pixelsOf(canvas));
    onChange({ preview: canvas.toDataURL("image/jpeg", 0.85), report, source });
    if (source === "camera") stop();
    setError(null);
  }

  function shoot() {
    const video = videoRef.current;
    const canvas = video ? grabRegion(video, GUIDE, WORK_WIDTH) : null;
    if (!canvas) return setError("The camera isn't ready yet. Give it a second.");
    accept(canvas, "camera");
  }

  // Auto-capture: sample the frame a few times a second; take the photo once it's sharp and glare-free for a moment.
  useEffect(() => {
    if (state !== "live" || value) return;
    let good = 0;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const canvas = video ? grabRegion(video, GUIDE, WORK_WIDTH) : null;
      if (!canvas) return;
      const report = assessImage(pixelsOf(canvas));
      good = report.ok ? good + 1 : 0;
      setSteady(good);
      if (good >= STEADY_SAMPLES) {
        clearInterval(timer);
        accept(canvas, "camera");
      }
    }, 450);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `accept` is stable in effect; re-running on each render would reset the count
  }, [state, value]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type) || file.size > 15 * 1024 * 1024) return setError("Choose a photo (JPEG, PNG or HEIC) under 15 MB.");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = drawImage(bitmap, Math.min(WORK_WIDTH, bitmap.width));
      bitmap.close();
      if (!canvas) throw new Error("no canvas");
      accept(canvas, "upload");
    } catch {
      setError("That photo couldn't be opened here. Try a JPEG or PNG, or use the camera.");
    }
  }

  const label = side === "front" ? "Front of your ID" : "Back of your ID";

  if (value) {
    return (
      <div className="grid gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <div className="relative overflow-hidden rounded-xl border border-line bg-surface-sunk">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL that never leaves the device */}
          <img src={value.preview} alt={`${label}, as captured`} className="aspect-[85.6/54] w-full object-cover" />
          <span
            className={cn(
              "absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              value.report.ok ? "bg-success-tint text-success" : "bg-warning-tint text-warning",
            )}
          >
            {value.report.ok ? "Clear and readable" : "Could be clearer"}
          </span>
        </div>
        {!value.report.ok && (
          <FormAlert tone="info">
            {value.report.problems.map((p) => PROBLEM_ADVICE[p]).join(" ")} You can keep this photo, but a clearer one is less likely to be sent back.
          </FormAlert>
        )}
        <Button type="button" variant="secondary" size="sm" className="w-fit rounded-full" onClick={() => onChange(null)}>
          <RefreshCw aria-hidden /> Retake
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-sunk">
        <video ref={videoRef} playsInline muted className={cn("absolute inset-0 size-full object-cover", state !== "live" && "invisible")} />
        {state === "live" ? (
          <>
            {/* The frame guide: a card-shaped window with the rest of the view dimmed. */}
            <div aria-hidden className="absolute inset-0 grid place-items-center">
              <div
                className={cn(
                  "relative aspect-[85.6/54] w-[86%] rounded-xl border-2 shadow-[0_0_0_100vmax_rgb(18_12_25/0.62)] transition-colors duration-300",
                  steady > 0 ? "border-success" : "border-champagne",
                )}
              >
                {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl"].map((c) => (
                  <span key={c} className={cn("absolute size-6", c, steady > 0 ? "border-success" : "border-champagne")} />
                ))}
              </div>
            </div>
            <p aria-live="polite" className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-fg">
              {steady > 0 ? "Hold still…" : `Fit the ${side} of the card inside the frame`}
            </p>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="grid justify-items-center gap-3">
              <ScanLine className="size-9 text-champagne" aria-hidden />
              {state === "denied" ? (
                <p className="text-sm text-muted">Camera access was blocked. Allow it in your browser&apos;s site settings, or upload a photo instead.</p>
              ) : state === "unavailable" ? (
                <p className="text-sm text-muted">No camera we can use on this device. Upload a photo instead.</p>
              ) : (
                <p className="text-sm text-muted">Lay the card on a dark, flat surface in good light.</p>
              )}
              {state !== "denied" && state !== "unavailable" && (
                <Button type="button" size="sm" className="rounded-full px-5" onClick={() => void start()} disabled={state === "starting"}>
                  <Camera aria-hidden /> {state === "starting" ? "Opening camera…" : "Open camera"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        {state === "live" && (
          <Button type="button" size="sm" className="rounded-full px-5" onClick={shoot}>
            <Camera aria-hidden /> Take photo
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => fileRef.current?.click()}>
          <ImageUp aria-hidden /> Upload a photo instead
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      </div>
    </div>
  );
}
