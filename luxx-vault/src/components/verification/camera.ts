"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "starting" | "live" | "denied" | "unavailable";

/**
 * A camera stream bound to a <video>. Rear camera for documents, front for
 * the selfie. Stops the tracks whenever the component unmounts or the caller
 * says so, so the camera light never stays on after a step.
 */
export function useCamera(facingMode: "environment" | "user") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((s) => (s === "live" || s === "starting" ? "idle" : s));
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setState("live");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, [facingMode]);

  useEffect(() => stop, [stop]);

  return { videoRef, state, start: startCamera, stop };
}

/**
 * Copies what sits inside the on-screen guide onto a canvas `outWidth` wide.
 * The video is shown with object-fit: cover in a box of `viewAspect`, so the
 * visible part is a centred crop of the stream; the guide is `widthShare` of
 * that visible width, with its own `aspect` (w/h).
 */
export function grabRegion(
  video: HTMLVideoElement,
  guide: { widthShare: number; aspect: number; viewAspect: number },
  outWidth: number,
): HTMLCanvasElement | null {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  if (!sw || !sh) return null;
  const visibleW = sw / sh > guide.viewAspect ? sh * guide.viewAspect : sw;
  let cw = visibleW * guide.widthShare;
  let ch = cw / guide.aspect;
  if (ch > sh) {
    ch = sh;
    cw = ch * guide.aspect;
  }
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = Math.round(outWidth / guide.aspect);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** A whole uploaded photo, scaled to `outWidth` (never enlarged beyond it). */
export function drawImage(image: ImageBitmap, outWidth: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = Math.max(1, Math.round((outWidth * image.height) / image.width));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function pixelsOf(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: img.data, width: img.width, height: img.height };
}
