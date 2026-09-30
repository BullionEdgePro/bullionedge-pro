"use client";

import { Camera, Contrast, ImageUp, Maximize2, RotateCcw, RotateCw, ScanSearch, SunMedium, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const LENS = 150; // magnifier diameter, px
const LENS_POWER = 2.5;

type View = { zoom: number; x: number; y: number; rotate: number };
type Tune = { brightness: number; contrast: number; sharpen: number; invert: boolean; mono: boolean };

const START_VIEW: View = { zoom: 1, x: 0, y: 0, rotate: 0 };
const START_TUNE: Tune = { brightness: 1, contrast: 1.15, sharpen: 0.4, invert: false, mono: true };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A jeweller's loupe for a photo of a tiny stamp. Everything happens in the
 * browser: the photo is never uploaded.
 *
 * - Camera (rear, via getUserMedia) or a photo from the library.
 * - Zoom to 8× by pinch, wheel/trackpad or slider; drag to pan; rotate.
 * - Brightness, contrast, sharpen (an SVG convolution), invert and mono, which
 *   is what makes a worn engraving readable.
 * - A circular magnifier that follows the pointer (or finger) at 2.5× on top.
 */
export function Loupe() {
  const [src, setSrc] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [view, setView] = useState<View>(START_VIEW);
  const [tune, setTune] = useState<Tune>(START_TUNE);
  const [lensOn, setLensOn] = useState(true);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number; mid: { x: number; y: number } } | null>(null);
  const filterId = useId().replace(/:/g, "");

  // Object URLs are revoked when replaced or on unmount.
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showImage = useCallback((blob: Blob) => {
    setSrc(URL.createObjectURL(blob));
    setView(START_VIEW);
  }, []);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't open the camera here. Use “Choose a photo” instead.");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamera("on");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      setCamera("off");
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was declined. Allow it in your browser settings, or choose a photo instead."
          : "We couldn't open a camera. Choose a photo instead.",
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((b) => b && showImage(b), "image/jpeg", 0.95);
    stopCamera();
  }

  // ---------------------------------------------------------------- gestures

  /** Zoom by a factor around a point in stage coordinates (so what's under the finger stays put). */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      setView((v) => {
        const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const k = zoom / v.zoom;
        const cx = px - size.w / 2;
        const cy = py - size.h / 2;
        return { ...v, zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      });
    },
    [size.w, size.h],
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !src) return;
    // Non-passive, so the page doesn't scroll while zooming the photo.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [src, zoomAt]);

  function local(e: ReactPointerEvent) {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      setLens(null);
    } else if (lensOn) {
      setLens(p);
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!src) return;
    const p = local(e);
    const prev = pointers.current.get(e.pointerId);
    const pan = () => prev && setView((v) => ({ ...v, x: v.x + (p.x - prev.x), y: v.y + (p.y - prev.y) }));
    if (e.pointerType === "mouse") {
      // Mouse: the lens follows the pointer; dragging with the button down moves the photo.
      if (lensOn) setLens(p);
      if (prev && e.buttons === 1) pan();
    } else if (prev) {
      if (pointers.current.size >= 2 && gesture.current) {
        pointers.current.set(e.pointerId, p);
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const target = clamp(gesture.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.dist), MIN_ZOOM, MAX_ZOOM);
        zoomAt(target / view.zoom, gesture.current.mid.x, gesture.current.mid.y);
        return;
      }
      // Touch: one finger carries the lens when it's on, or moves the photo when it's off.
      if (lensOn) setLens(p);
      else pan();
    }
    if (prev) pointers.current.set(e.pointerId, p);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (e.pointerType !== "mouse") setLens(null);
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = 24;
    const map: Record<string, () => void> = {
      "+": () => zoomAt(1.25, size.w / 2, size.h / 2),
      "=": () => zoomAt(1.25, size.w / 2, size.h / 2),
      "-": () => zoomAt(0.8, size.w / 2, size.h / 2),
      ArrowLeft: () => setView((v) => ({ ...v, x: v.x + step })),
      ArrowRight: () => setView((v) => ({ ...v, x: v.x - step })),
      ArrowUp: () => setView((v) => ({ ...v, y: v.y + step })),
      ArrowDown: () => setView((v) => ({ ...v, y: v.y - step })),
      r: () => setView((v) => ({ ...v, rotate: normaliseAngle(v.rotate + 90) })),
      "0": () => setView(START_VIEW),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  // ---------------------------------------------------------------- rendering

  // Sharpen: identity plus a scaled Laplacian. 0 = off, 1 = strong.
  const s = tune.sharpen;
  const kernel = `0 ${-s} 0 ${-s} ${1 + 4 * s} ${-s} 0 ${-s} 0`;
  const cssFilter = [
    `url(#${filterId})`,
    tune.mono ? "grayscale(1)" : "",
    `brightness(${tune.brightness})`,
    `contrast(${tune.contrast})`,
    tune.invert ? "invert(1)" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const transform = `translate(${view.x}px, ${view.y}px) rotate(${view.rotate}deg) scale(${view.zoom})`;

  const picture = (key: string) =>
    src && (
      // eslint-disable-next-line @next/next/no-img-element -- a local object URL; next/image can't optimise it
      <img
        key={key}
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
        style={{ transform, transformOrigin: "center", filter: cssFilter }}
      />
    );

  return (
    <div className="grid gap-4">
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id={filterId}>
          <feConvolveMatrix order="3" kernelMatrix={kernel} preserveAlpha="true" />
        </filter>
      </svg>

      {/* ------------------------------------------------ the eyepiece */}
      <div
        ref={stageRef}
        role={src ? "application" : undefined}
        aria-label={src ? "Stamp photo. Drag to move, pinch or scroll to zoom, plus and minus keys to zoom, R to rotate, 0 to reset." : undefined}
        tabIndex={src ? 0 : -1}
        onKeyDown={src ? onKeyDown : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => e.pointerType === "mouse" && setLens(null)}
        className={cn(
          "relative isolate aspect-square w-full touch-none overflow-hidden rounded-[1.75rem] border border-gold-large/30 bg-[radial-gradient(circle_at_50%_40%,#2a2036,#0c0812_75%)] sm:aspect-[4/3]",
          src && (lensOn ? "cursor-none" : "cursor-grab active:cursor-grabbing"),
        )}
      >
        {/* reticle: fine crosshair and a graduated ring, like a loupe's eyepiece */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-4 rounded-[1.25rem] border border-champagne/10" />
          <div className="absolute top-1/2 left-1/2 size-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-champagne/15" />
          <div className="absolute top-1/2 left-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-champagne/30" />
          <div className="absolute top-1/2 left-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-champagne/30" />
        </div>

        {camera !== "off" && (
          <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" aria-label="Camera preview" />
        )}

        {camera === "off" && picture("main")}

        {camera === "off" && !src && (
          <div className="absolute inset-0 z-20 grid place-items-center p-6 text-center">
            <div className="grid max-w-xs justify-items-center gap-3">
              <ScanSearch className="size-10 text-champagne" aria-hidden />
              <p className="font-display text-xl tracking-wide">Place the stamp under the loupe</p>
              <p className="text-sm text-muted">Photograph the inside of the ring or the clasp in good light, as close as your camera will focus.</p>
            </div>
          </div>
        )}

        {/* magnifier */}
        {src && camera === "off" && lensOn && lens && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-20 overflow-hidden rounded-full border-2 border-champagne/80 shadow-[0_0_0_1px_rgb(0_0_0/0.6),0_18px_40px_-10px_rgb(0_0_0/0.9),inset_0_0_24px_rgb(0_0_0/0.6)]"
            style={{ width: LENS, height: LENS, left: lens.x - LENS / 2, top: lens.y - LENS / 2 }}
          >
            <div
              className="absolute bg-[#0c0812]"
              style={{
                width: size.w,
                height: size.h,
                left: LENS / 2 - lens.x,
                top: LENS / 2 - lens.y,
                transform: `scale(${LENS_POWER})`,
                transformOrigin: `${lens.x}px ${lens.y}px`,
              }}
            >
              {picture("lens")}
            </div>
            <div className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-champagne/70" />
          </div>
        )}

        {src && camera === "off" && (
          <p className="pointer-events-none absolute bottom-3 left-4 z-20 rounded-full bg-black/55 px-3 py-1 text-xs text-pearl/90 tabular backdrop-blur">
            {view.zoom.toFixed(1)}× · {((view.rotate % 360) + 360) % 360}°
          </p>
        )}
      </div>

      {/* ------------------------------------------------ capture */}
      <div className="flex flex-wrap gap-2">
        {camera === "on" ? (
          <>
            <Button type="button" onClick={capture} size="lg" className="flex-1 sm:flex-none">
              <Camera aria-hidden /> Capture
            </Button>
            <Button type="button" variant="ghost" onClick={stopCamera}>
              <X aria-hidden /> Cancel
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={startCamera} disabled={camera === "starting"} className="flex-1 sm:flex-none">
              <Camera aria-hidden /> {camera === "starting" ? "Opening camera…" : src ? "Retake" : "Use the camera"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} className="flex-1 sm:flex-none">
              <ImageUp aria-hidden /> Choose a photo
            </Button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.type.startsWith("image/")) showImage(f);
            e.target.value = "";
          }}
        />
      </div>
      {cameraError && (
        <p role="alert" className="text-sm text-warning">
          {cameraError}
        </p>
      )}

      {/* ------------------------------------------------ instrument controls */}
      {src && camera === "off" && (
        <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <Slider label="Zoom" icon={Maximize2} min={1} max={8} step={0.1} value={view.zoom} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => zoomAt(v / view.zoom, size.w / 2, size.h / 2)} />
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Slider label="Rotate" icon={RotateCw} min={-180} max={180} step={1} value={normaliseAngle(view.rotate)} format={(v) => `${v}°`} onChange={(v) => setView((s) => ({ ...s, rotate: v }))} />
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="ghost" aria-label="Rotate left 90°" onClick={() => setView((s) => ({ ...s, rotate: normaliseAngle(s.rotate - 90) }))}>
                <RotateCcw aria-hidden />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Rotate right 90°" onClick={() => setView((s) => ({ ...s, rotate: normaliseAngle(s.rotate + 90) }))}>
                <RotateCw aria-hidden />
              </Button>
            </div>
          </div>
          <Slider label="Brightness" icon={SunMedium} min={0.4} max={2.2} step={0.05} value={tune.brightness} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setTune((t) => ({ ...t, brightness: v }))} />
          <Slider label="Contrast" icon={Contrast} min={0.5} max={3} step={0.05} value={tune.contrast} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setTune((t) => ({ ...t, contrast: v }))} />
          <Slider label="Sharpen" icon={ScanSearch} min={0} max={1.5} step={0.05} value={tune.sharpen} format={(v) => (v === 0 ? "Off" : `${Math.round(v * 100)}`)} onChange={(v) => setTune((t) => ({ ...t, sharpen: v }))} />
          <div className="flex flex-wrap gap-2">
            <Toggle pressed={tune.mono} onClick={() => setTune((t) => ({ ...t, mono: !t.mono }))}>
              Mono
            </Toggle>
            <Toggle pressed={tune.invert} onClick={() => setTune((t) => ({ ...t, invert: !t.invert }))}>
              Invert
            </Toggle>
            <Toggle pressed={lensOn} onClick={() => setLensOn((l) => !l)}>
              Magnifier
            </Toggle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setView(START_VIEW);
                setTune(START_TUNE);
              }}
            >
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted">
            {lensOn ? "Magnifier on: hover or touch to look closer; pinch or scroll to zoom. Turn it off to drag the photo." : "Drag to move; pinch or scroll to zoom."}{" "}
            Invert often makes a stamp stand out when light catches the metal.
          </p>
        </div>
      )}
    </div>
  );
}

function normaliseAngle(a: number) {
  const n = ((((a + 180) % 360) + 360) % 360) - 180;
  return n === -180 ? 180 : n;
}

function Slider({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  icon: typeof Camera;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-champagne" aria-hidden /> {label}
        </label>
        <span className="text-muted tabular">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[var(--color-champagne)]"
      />
    </div>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="h-9 rounded-full border border-line px-4 text-sm font-semibold text-fg/80 transition-colors aria-pressed:border-champagne aria-pressed:bg-gold-tint aria-pressed:text-champagne"
    >
      {children}
    </button>
  );
}
