/**
 * Image pipeline for marketplace photos (brief §4, §9, §11), using sharp:
 * magic-byte check → auto-orient → strip every bit of metadata (EXIF, GPS,
 * ICC comments) → fit within 1600 px → WebP, plus a SHA-256 and a dHash.
 * Listing photos get the Luxx4less watermark (emblem + listing code).
 *
 * No `server-only` import so the local seed script can reuse it; nothing here
 * touches the database.
 */
import { createHash } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { emblemMarkup } from "@/components/brand/logo-svg";
import { DHASH_HEIGHT, DHASH_WIDTH, dhashFromGray } from "./dhash";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_EDGE = 1600;

export type SniffedType = "jpeg" | "png" | "webp" | "avif" | "heic" | null;

/** Identify an image by its first bytes, never by its name or the browser's claim. */
export function sniffImageType(buf: Uint8Array): SniffedType {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export class ImageRejected extends Error {}

export type ProcessedImage = {
  bytes: Buffer;
  mime: "image/webp";
  width: number;
  height: number;
  sha256: string;
  phash: string;
};

/** A 9×8 grayscale thumbnail → 64-bit difference hash. */
export async function dhashOf(input: Buffer): Promise<string> {
  const { data } = await sharp(input)
    .grayscale()
    .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return dhashFromGray(new Uint8Array(data.buffer, data.byteOffset, DHASH_WIDTH * DHASH_HEIGHT));
}

/**
 * Validate and re-encode one upload. Throws ImageRejected with a message fit
 * to show the person. The output carries no metadata: sharp drops EXIF, GPS
 * and XMP unless asked to keep them, and we never ask.
 */
export async function processUpload(input: Uint8Array): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageRejected("That photo is larger than 10 MB. Please choose a smaller one.");
  const type = sniffImageType(input);
  if (!type) throw new ImageRejected("That file isn't a photo we can read. Please use JPEG, PNG or WebP.");
  if (type === "heic" && !sharp.format.heif.input.fileSuffix?.includes(".heic")) {
    throw new ImageRejected("iPhone HEIC photos aren't supported yet. In Settings › Camera › Formats choose “Most Compatible”, or share the photo as JPEG.");
  }
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(input.buffer, input.byteOffset, input.byteLength), { failOn: "error", limitInputPixels: 60_000_000 })
      .rotate() // honour EXIF orientation, then the orientation tag goes with the rest of the metadata
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageRejected("We couldn't read that photo. It may be damaged; please try another.");
  }
  if (out.info.width < 200 || out.info.height < 200) throw new ImageRejected("That photo is too small. Please use one at least 200 pixels on each side.");
  return {
    bytes: out.data,
    mime: "image/webp",
    width: out.info.width,
    height: out.info.height,
    sha256: createHash("sha256").update(out.data).digest("hex"),
    phash: await dhashOf(out.data),
  };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/**
 * Stamp a listing photo: the Luxx4less emblem, large and faint across the
 * centre (hard to crop out without ruining the photo), plus a small plate in
 * the corner with the listing code, so a stolen copy points back here.
 */
export async function watermarkListingPhoto(webp: Buffer, code: string): Promise<{ bytes: Buffer; sha256: string }> {
  const meta = await sharp(webp).metadata();
  const w = meta.width ?? MAX_EDGE;
  const h = meta.height ?? MAX_EDGE;
  const short = Math.min(w, h);
  const emblemSize = Math.round(short * 0.42);
  const plateH = Math.max(22, Math.round(short * 0.045));
  const font = Math.round(plateH * 0.52);
  const label = escapeXml(`${code} · Luxx4less`);
  const plateW = Math.round(font * 0.62 * label.length + plateH);
  const pad = Math.round(plateH * 0.6);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <g opacity="0.16" transform="translate(${(w - emblemSize) / 2} ${(h - emblemSize) / 2}) scale(${emblemSize / 200})">
    ${emblemMarkup({ id: "wm", detail: "mono", color: "#FFFFFF" })}
  </g>
  <g transform="translate(${w - plateW - pad} ${h - plateH - pad})">
    <rect width="${plateW}" height="${plateH}" rx="${plateH / 2}" fill="#17101F" fill-opacity="0.55"/>
    <text x="${plateW / 2}" y="${plateH / 2}" dominant-baseline="central" text-anchor="middle" font-family="DejaVu Sans, Segoe UI, Arial, Helvetica, sans-serif" font-size="${font}" font-weight="600" letter-spacing="0.5" fill="#D6B26E">${label}</text>
  </g>
</svg>`;
  const bytes = await sharp(webp)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
