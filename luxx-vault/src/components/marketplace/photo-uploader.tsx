"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type UploadedPhoto = { id: string; url: string };

type Item =
  | { key: string; state: "uploading"; preview: string; progress: number }
  | { key: string; state: "done"; id: string; url: string; preview?: string }
  | { key: string; state: "error"; preview: string; error: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

function upload(file: File, purpose: string, onProgress: (p: number) => void): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.set("purpose", purpose);
    body.set("file", file);
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let json: { id?: string; url?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.id && json.url) resolve({ id: json.id, url: json.url });
      else reject(new Error(json.error ?? "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.send(body);
  });
}

/**
 * Photo picker for listings (and single-photo uses like a showroom cover or
 * dispute evidence). Uploads as soon as photos are chosen, shows progress,
 * and lets the seller drag, or use the arrow buttons, to reorder. The first
 * photo is the cover. The chosen ids are submitted in a hidden input.
 */
export function PhotoUploader({
  name,
  purpose,
  max = 8,
  initial = [],
  onChange,
  hint,
  error,
  label = "Photos",
}: {
  name: string;
  purpose: "listing" | "showroom_cover" | "dispute_evidence";
  max?: number;
  initial?: UploadedPhoto[];
  onChange?: (photos: UploadedPhoto[]) => void;
  hint?: string;
  error?: string;
  label?: string;
}) {
  const [items, setItems] = useState<Item[]>(() => initial.map((p) => ({ key: p.id, state: "done", id: p.id, url: p.url })));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const done = items.filter((i): i is Extract<Item, { state: "done" }> => i.state === "done");
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const doneJson = JSON.stringify(done.map((d) => ({ id: d.id, url: d.url })));
  useEffect(() => {
    onChangeRef.current?.(JSON.parse(doneJson) as UploadedPhoto[]);
  }, [doneJson]);

  const add = (files: FileList | File[]) => {
    const room = max - items.filter((i) => i.state !== "error").length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      setItems((prev) => [...prev, { key, state: "uploading", preview, progress: 0 }]);
      upload(file, purpose, (progress) => setItems((prev) => prev.map((i) => (i.key === key && i.state === "uploading" ? { ...i, progress } : i))))
        .then((res) => setItems((prev) => prev.map((i) => (i.key === key ? { key, state: "done", id: res.id, url: res.url, preview } : i))))
        .catch((err: Error) => setItems((prev) => prev.map((i) => (i.key === key ? { key, state: "error", preview, error: err.message } : i))));
    }
  };

  const move = (key: string, delta: number) =>
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it!);
      return next;
    });

  const moveTo = (key: string, targetKey: string) =>
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === key);
      const to = prev.findIndex((i) => i.key === targetKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it!);
      return next;
    });

  const remove = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const full = items.filter((i) => i.state !== "error").length >= max;

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(done.map((d) => d.id))} />
      <ul className={cn("grid gap-3", max > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1")}>
        {items.map((item, index) => {
          const src = item.state === "done" ? (item.preview ?? item.url) : item.preview;
          return (
            <li
              key={item.key}
              draggable={item.state === "done" && max > 1}
              onDragStart={() => setDragKey(item.key)}
              onDragOver={(e) => {
                if (dragKey) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKey) moveTo(dragKey, item.key);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-surface-sunk",
                max > 1 ? "aspect-square" : "aspect-[16/7]",
                item.state === "error" ? "border-danger/60" : index === 0 && max > 1 ? "border-champagne" : "border-line",
                dragKey === item.key && "opacity-50",
              )}
            >
              {/* A local object URL or a private draft photo: shown as is, never through the optimiser. */}
              <Image src={src} alt={`Photo ${index + 1}`} fill unoptimized sizes="200px" className="object-cover" />
              {item.state === "uploading" && (
                <div className="absolute inset-0 grid place-items-center bg-velvet/70">
                  <div className="grid w-2/3 gap-2 text-center text-xs text-pearl">
                    <Loader2 className="mx-auto size-5 animate-spin text-champagne" aria-hidden />
                    <span>Securing photo…</span>
                    <span className="h-1 overflow-hidden rounded-full bg-line">
                      <span className="block h-full bg-champagne transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    </span>
                  </div>
                </div>
              )}
              {item.state === "error" && (
                <div role="alert" className="absolute inset-0 grid place-items-center bg-velvet/85 p-3 text-center text-xs text-danger">
                  {item.error}
                </div>
              )}
              {index === 0 && item.state === "done" && max > 1 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-velvet/80 px-2 py-0.5 text-[0.7rem] font-semibold text-champagne">
                  <Star className="size-3 fill-champagne" aria-hidden /> Cover
                </span>
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                <button type="button" onClick={() => remove(item.key)} className="grid size-7 place-items-center rounded-full bg-velvet/80 text-pearl hover:text-danger" aria-label={`Remove photo ${index + 1}`}>
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {item.state === "done" && max > 1 && items.length > 1 && (
                <div className="absolute right-2 bottom-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" onClick={() => move(item.key, -1)} disabled={index === 0} className="grid size-7 place-items-center rounded-full bg-velvet/80 text-pearl disabled:opacity-40" aria-label={`Move photo ${index + 1} earlier`}>
                    <ArrowLeft className="size-3.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(item.key, 1)} disabled={index === items.length - 1} className="grid size-7 place-items-center rounded-full bg-velvet/80 text-pearl disabled:opacity-40" aria-label={`Move photo ${index + 1} later`}>
                    <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {!full && (
          <li className={cn(max > 1 ? "aspect-square" : "aspect-[16/7]", items.length === 0 && max > 1 && "col-span-2 aspect-auto sm:col-span-4")}>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                if (e.dataTransfer.files.length) add(e.dataTransfer.files);
              }}
              className={cn(
                "flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-sm transition-colors",
                over ? "border-champagne bg-gold-tint text-champagne" : "border-champagne/35 text-muted hover:border-champagne hover:text-champagne",
              )}
            >
              <ImagePlus className="size-6" aria-hidden />
              <span className="font-semibold">{items.length ? "Add more" : max > 1 ? "Add photos" : "Choose a photo"}</span>
              {items.length === 0 && <span className="text-xs">Drag them here or tap to choose. JPEG, PNG or WebP, up to 10 MB each.</span>}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple={max > 1} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files && (add(e.target.files), (e.target.value = ""))} />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
