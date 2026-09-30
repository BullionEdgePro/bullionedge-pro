"use client";

import { ArrowLeft, ArrowRight, Camera, CircleCheck, Eye, RefreshCw, ScanFace } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { grabRegion, pixelsOf, useCamera } from "./camera";
import { MOVEMENT_THRESHOLD, frameDifference, toGray } from "./image-quality";

export type Prompt = "center" | "left" | "right" | "blink";
export type LivenessResult = { prompts: { prompt: Prompt; movement: number; passed: boolean }[]; framesCaptured: number };

const SEQUENCE: { prompt: Prompt; text: string; icon: typeof Eye; ms: number }[] = [
  { prompt: "center", text: "Look straight at the camera", icon: ScanFace, ms: 1600 },
  { prompt: "left", text: "Slowly turn your head to the left", icon: ArrowLeft, ms: 2000 },
  { prompt: "right", text: "Now slowly to the right", icon: ArrowRight, ms: 2000 },
  { prompt: "blink", text: "Look back and blink twice", icon: Eye, ms: 1800 },
];

/** Oval guide: 62% of the view's width, 3:4 face proportions, view is 3:4 too. */
const OVAL = { widthShare: 0.62, aspect: 3 / 4, viewAspect: 3 / 4 };
const EYES = { widthShare: 0.5, aspect: 2.4, viewAspect: 3 / 4 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Guided selfie check: look ahead, turn left, turn right, blink. Small
 * greyscale frames are compared on this device to confirm the face actually
 * moved on cue, then thrown away. This is a guide for the reviewer, not a
 * certified liveness test; the live vendor performs that.
 */
export function LivenessCapture({ value, onChange }: { value: LivenessResult | null; onChange: (v: LivenessResult | null) => void }) {
  const cam = useCamera("user");
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);
  const { state, videoRef, start, stop } = cam;

  const frame = (guide: typeof OVAL, width: number) => {
    const v = videoRef.current;
    const c = v ? grabRegion(v, guide, width) : null;
    return c ? toGray(pixelsOf(c)) : null;
  };

  async function run() {
    cancelled.current = false;
    setRunning(true);
    onChange(null);
    const results: LivenessResult["prompts"] = [];
    let frames = 0;
    let baseline: Float32Array | null = null;
    for (let i = 0; i < SEQUENCE.length; i++) {
      const s = SEQUENCE[i]!;
      setStep(i);
      if (s.prompt === "blink") {
        // A burst over the eye band: blinking changes it briefly even when the head is still.
        const burst: Float32Array[] = [];
        const until = Date.now() + s.ms;
        while (Date.now() < until && !cancelled.current) {
          const f = frame(EYES, 120);
          if (f) burst.push(f);
          await sleep(90);
        }
        frames += burst.length;
        const first = burst[0];
        const movement = first ? Math.max(0, ...burst.slice(1).map((f) => frameDifference(first, f))) : 0;
        results.push({ prompt: "blink", movement: Math.round(movement * 100) / 100, passed: movement >= MOVEMENT_THRESHOLD.blink });
      } else {
        await sleep(s.ms);
        const f = frame(OVAL, 96);
        if (f) frames++;
        if (s.prompt === "center") {
          baseline = f;
          results.push({ prompt: "center", movement: 0, passed: Boolean(f) });
        } else {
          const movement = baseline && f ? frameDifference(baseline, f) : 0;
          results.push({ prompt: s.prompt, movement: Math.round(movement * 100) / 100, passed: movement >= MOVEMENT_THRESHOLD.turn });
        }
      }
      if (cancelled.current) break;
    }
    stop();
    setRunning(false);
    setStep(-1);
    if (!cancelled.current) onChange({ prompts: results, framesCaptured: frames });
  }

  if (value) {
    const moves = value.prompts.filter((p) => p.prompt !== "center");
    const passed = moves.filter((p) => p.passed).length;
    return (
      <div className="grid gap-4 rounded-xl border border-line bg-surface-sunk/60 p-5">
        <div className="flex items-center gap-3">
          <CircleCheck className={cn("size-6 shrink-0", passed === moves.length ? "text-success" : "text-warning")} aria-hidden />
          <div>
            <p className="font-semibold">Selfie check done</p>
            <p className="text-sm text-muted">
              Movement seen on {passed} of {moves.length} prompts. The frames were compared on this device and discarded.
            </p>
          </div>
        </div>
        {passed < moves.length && <p className="text-sm text-warning">Some movements weren&apos;t picked up. Try again in brighter light, facing the screen.</p>}
        <Button type="button" variant="secondary" size="sm" className="w-fit rounded-full" onClick={() => onChange(null)}>
          <RefreshCw aria-hidden /> Do it again
        </Button>
      </div>
    );
  }

  const current = step >= 0 ? SEQUENCE[step] : null;
  return (
    <div className="grid gap-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-surface-sunk">
        <video ref={videoRef} playsInline muted className={cn("absolute inset-0 size-full -scale-x-100 object-cover", state !== "live" && "invisible")} />
        {state === "live" ? (
          <>
            <div aria-hidden className="absolute inset-0 grid place-items-center">
              <div className="aspect-[3/4] w-[62%] rounded-[50%] border-2 border-champagne shadow-[0_0_0_100vmax_rgb(18_12_25/0.6)]" />
            </div>
            <div aria-live="assertive" className="absolute inset-x-3 bottom-3 grid justify-items-center gap-2 text-center">
              {current ? (
                <p className="flex items-center gap-2 rounded-full bg-velvet/85 px-4 py-1.5 text-sm font-semibold text-fg">
                  <current.icon className="size-4 text-champagne" aria-hidden /> {current.text}
                </p>
              ) : (
                <p className="rounded-full bg-velvet/85 px-4 py-1.5 text-sm text-fg">Centre your face in the oval</p>
              )}
            </div>
            <ol aria-hidden className="absolute inset-x-0 top-3 flex justify-center gap-1.5">
              {SEQUENCE.map((s, i) => (
                <li key={s.prompt} className={cn("h-1 w-8 rounded-full transition-colors", i < step ? "bg-champagne" : i === step ? "bg-champagne/70" : "bg-fg/25")} />
              ))}
            </ol>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="grid justify-items-center gap-3">
              <ScanFace className="size-10 text-champagne" aria-hidden />
              <p className="text-sm text-muted">
                {state === "denied"
                  ? "Camera access was blocked. Allow it in your browser's site settings to continue."
                  : state === "unavailable"
                    ? "This device has no front camera we can use. Continue on your phone for the selfie check."
                    : "Four quick prompts, about ten seconds. Remove sunglasses or a cap."}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {state !== "live" && state !== "denied" && state !== "unavailable" && (
          <Button type="button" className="rounded-full px-6" onClick={() => void start()} disabled={state === "starting"}>
            <Camera aria-hidden /> {state === "starting" ? "Opening camera…" : "Open front camera"}
          </Button>
        )}
        {state === "live" && !running && (
          <Button type="button" className="rounded-full px-6" onClick={() => void run()}>
            Start the selfie check
          </Button>
        )}
        {running && (
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
