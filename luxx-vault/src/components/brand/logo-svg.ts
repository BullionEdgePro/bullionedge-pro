/**
 * Draws the Luxx4less emblem as SVG markup. Pure string building, so the same
 * artwork serves the React component, the icon/file build scripts and the 3D
 * bar's stamp texture.
 *
 * Detail levels:
 *  - "full":   faithful to the original: flat peach-gold frame, bevelled metal L,
 *              brilliant-cut stones down the stem (and one at the foot).
 *  - "simple": for 16–48px (favicon, app icon): just the eight-point star
 *              (square + diamond) in heavy lines, a larger flat L and an ice
 *              channel instead of individual stones.
 *  - "mono":   one colour (currentColor or `color`), stones cut out of the L —
 *              for photo watermarks and light backgrounds.
 */
import { LOGO } from "./logo-data";

export type EmblemDetail = "full" | "simple" | "mono";

export interface EmblemOptions {
  /** Unique prefix for gradient/clip ids (several emblems can share a page). */
  id: string;
  detail?: EmblemDetail;
  /** Frame finish for "full": the original flat colour, or a metallic foil gradient. */
  frame?: "flat" | "foil";
  /** Adds classes the CSS uses for the draw-in and twinkle animation. */
  animate?: boolean;
  /** Mono colour; defaults to currentColor. */
  color?: string;
  /** Solid backdrop (icons): a rounded square behind the emblem. */
  background?: string;
  backgroundRadius?: number;
  /** Shrinks the artwork inside the 200 box (icons need a safe margin). */
  inset?: number;
}

export const LOGO_GOLD = "#E8BA88"; // the original frame colour, sampled
const RIM_LIGHT = "#FFF3C4";
const RIM_DARK = "#7A5520";

function gem(id: string, cx: number, cy: number, rad: number, i: number, glint: boolean, animate: boolean): string {
  // Brilliant cut, seen face-up: gradient body, octagonal table, 8 facet lines.
  const t = rad * 0.5;
  const table: string[] = [];
  const facets: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI / 4) * k + Math.PI / 8;
    const tx = cx + t * Math.cos(a);
    const ty = cy + t * Math.sin(a);
    table.push(`${tx.toFixed(2)} ${ty.toFixed(2)}`);
    facets.push(`M${tx.toFixed(2)} ${ty.toFixed(2)}L${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  const sw = (rad * 0.07).toFixed(2);
  let out =
    `<g class="${animate ? "lx-stone" : ""}" style="--i:${i}">` +
    `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#${id}-gem)" stroke="${RIM_DARK}" stroke-width="${(rad * 0.12).toFixed(2)}"/>` +
    `<path d="M${table.join("L")}Z" fill="#fff" fill-opacity=".38"/>` +
    `<path d="${facets.join("")}" stroke="#fff" stroke-opacity=".6" stroke-width="${sw}" fill="none"/>` +
    `</g>`;
  if (glint) {
    const L = rad * 2.1;
    const w = rad * 0.16;
    out +=
      `<path class="${animate ? "lx-glint" : ""}" style="--i:${i}" fill="#fff" d="` +
      `M${cx - L} ${cy}L${cx - w} ${cy - w}L${cx} ${cy - L}L${cx + w} ${cy - w}L${cx + L} ${cy}L${cx + w} ${cy + w}L${cx} ${cy + L}L${cx - w} ${cy + w}Z"/>`;
  }
  return out;
}

/** Inner markup for a `<svg viewBox="0 0 200 200">`. */
export function emblemMarkup(o: EmblemOptions): string {
  const { id, detail = "full", frame = "flat", animate = false } = o;
  const f = LOGO.frame;
  const inset = o.inset ?? 0;
  const scale = (200 - inset * 2) / 200;
  const wrapOpen = inset ? `<g transform="translate(${inset} ${inset}) scale(${scale})">` : "<g>";
  const bg = o.background ? `<rect width="200" height="200" rx="${o.backgroundRadius ?? 0}" fill="${o.background}"/>` : "";
  const draw = animate ? ` class="lx-frame" pathLength="1"` : "";

  if (detail === "mono") {
    const c = o.color ?? "currentColor";
    const holes = [...LOGO.stones, LOGO.footStone].map((s) => `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r * 0.78}" fill="#000"/>`).join("");
    return (
      `<defs><mask id="${id}-m"><rect width="200" height="200" fill="#fff"/>${holes}</mask></defs>` +
      bg +
      wrapOpen +
      `<g fill="none" stroke="${c}" stroke-width="${f.stroke}" stroke-linejoin="miter">` +
      [f.square, f.diamond, f.octagonOuter, f.octagonInner].map((d) => `<path d="${d}"${draw}/>`).join("") +
      `</g><path d="${LOGO.L}" fill="${c}" mask="url(#${id}-m)"/></g>`
    );
  }

  if (detail === "simple") {
    const c = o.color ?? LOGO_GOLD;
    const ch = LOGO.channel;
    return (
      `<defs><linearGradient id="${id}-metal" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#FFF0BC"/><stop offset=".45" stop-color="#E2B456"/><stop offset="1" stop-color="#B07F2A"/></linearGradient></defs>` +
      bg +
      wrapOpen +
      `<g fill="none" stroke="${c}" stroke-width="8" stroke-linejoin="miter">` +
      `<path d="${f.square}"/><path d="${f.diamond}"/></g>` +
      `<g transform="translate(100 100) scale(1.22) translate(-100 -100)">` +
      `<path d="${LOGO.L}" fill="url(#${id}-metal)" stroke="url(#${id}-metal)" stroke-width="4" stroke-linejoin="round" paint-order="stroke"/>` +
      `<rect x="${ch.x + 3}" y="${ch.y}" width="${ch.w - 6}" height="${ch.h}" rx="${(ch.w - 6) / 2}" fill="#EAF4F8"/>` +
      `</g></g>`
    );
  }

  // full
  const frameFill = frame === "foil" ? `url(#${id}-foil)` : LOGO_GOLD;
  const ch = LOGO.channel;
  const stones = LOGO.stones.map((s, i) => gem(id, s.cx, s.cy, s.r, i, !!("glint" in s && s.glint), animate)).join("");
  const foot = gem(id, LOGO.footStone.cx, LOGO.footStone.cy, LOGO.footStone.r, LOGO.stones.length, false, animate);
  return (
    `<defs>` +
    `<linearGradient id="${id}-metal" x1="0" y1="0" x2=".3" y2="1">` +
    `<stop offset="0" stop-color="#FFF4C7"/><stop offset=".18" stop-color="#F0CB6A"/><stop offset=".45" stop-color="#C8952F"/>` +
    `<stop offset=".62" stop-color="#F7DC86"/><stop offset=".85" stop-color="#A8741F"/><stop offset="1" stop-color="#E9C06A"/></linearGradient>` +
    `<linearGradient id="${id}-foil" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#F6D7AE"/><stop offset=".3" stop-color="${LOGO_GOLD}"/><stop offset=".55" stop-color="#B98A55"/>` +
    `<stop offset=".78" stop-color="#F3CE9D"/><stop offset="1" stop-color="#C99A62"/></linearGradient>` +
    `<radialGradient id="${id}-gem" cx=".38" cy=".32" r=".75">` +
    `<stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#EEF6FA"/><stop offset=".72" stop-color="#BFD8E4"/><stop offset="1" stop-color="#6F8797"/></radialGradient>` +
    `<clipPath id="${id}-clip"><path d="${LOGO.L}"/></clipPath>` +
    `</defs>` +
    bg +
    wrapOpen +
    `<g fill="none" stroke="${frameFill}" stroke-width="${f.stroke}" stroke-linejoin="miter">` +
    [f.square, f.diamond, f.octagonOuter, f.octagonInner].map((d) => `<path d="${d}"${draw}/>`).join("") +
    `</g>` +
    // Bevelled metal L: body, then a dark and a bright rim clipped to the inside edge.
    `<g class="${animate ? "lx-letter" : ""}">` +
    // A metal stroke under the fill thickens Bodoni's hairline serifs to the original's weight.
    `<path d="${LOGO.L}" fill="url(#${id}-metal)" stroke="url(#${id}-metal)" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/>` +
    `<g clip-path="url(#${id}-clip)" fill="none">` +
    `<path d="${LOGO.L}" stroke="${RIM_DARK}" stroke-width="3.4"/>` +
    `<path d="${LOGO.L}" stroke="${RIM_LIGHT}" stroke-width="1.5"/>` +
    `</g>` +
    // Channel the stones sit in
    `<rect x="${ch.x}" y="${ch.y}" width="${ch.w}" height="${ch.h}" rx="2" fill="#5E4318"/>` +
    stones +
    foot +
    `</g></g>`
  );
}

export function emblemSvg(o: EmblemOptions & { title?: string }): string {
  const title = o.title ?? "Luxx4less";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO.viewBox}" role="img" aria-label="${title}">${emblemMarkup(o)}</svg>\n`;
}

/** Emblem plus wordmark as outlines, for standalone files (the site uses live text). */
export function lockupSvg(o: EmblemOptions & { layout: "stacked" | "horizontal"; textColor?: string; taglineColor?: string }): string {
  const text = o.textColor ?? "#D6B26E";
  const tagColor = o.taglineColor ?? text;
  const w = LOGO.wordmark.box;
  const t = LOGO.tagline.box;
  const ww = w.x2 - w.x1;
  const tw = t.x2 - t.x1;
  const emblem = `<svg x="0" y="0" width="200" height="200" viewBox="0 0 200 200">${emblemMarkup(o)}</svg>`;
  if (o.layout === "stacked") {
    // Wordmark width matched to the emblem's, tagline to the wordmark's.
    const W = 300;
    const sw = (W * 0.86) / ww;
    const st = (W * 0.86) / tw;
    const top = 210;
    const wordY = top + (w.y2 - w.y1) * sw;
    const tagY = wordY + 18 + (t.y2 - t.y1) * st;
    const H = Math.ceil(tagY + 10);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Luxx4less Golds and Diamonds Jewelries">` +
      (o.background ? `<rect width="${W}" height="${H}" fill="${o.background}"/>` : "") +
      `<g transform="translate(50 0)">${emblem}</g>` +
      `<path transform="translate(${(W - ww * sw) / 2 - w.x1 * sw} ${wordY - w.y2 * sw}) scale(${sw})" d="${LOGO.wordmark.d}" fill="${text}"/>` +
      `<path transform="translate(${(W - tw * st) / 2 - t.x1 * st} ${tagY - t.y2 * st}) scale(${st})" d="${LOGO.tagline.d}" fill="${tagColor}"/>` +
      `</svg>\n`
    );
  }
  // horizontal: emblem left, wordmark right (like the Facebook cover)
  const sw = 92 / (w.y2 - w.y1);
  const textW = ww * sw;
  const st = textW / tw;
  const x = 222;
  const W = Math.ceil(x + textW + 8);
  const wordTop = 42;
  const wordBottom = wordTop + (w.y2 - w.y1) * sw;
  const tagBottom = wordBottom + 16 + (t.y2 - t.y1) * st;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 200" role="img" aria-label="Luxx4less Golds and Diamonds Jewelries">` +
    (o.background ? `<rect width="${W}" height="200" fill="${o.background}"/>` : "") +
    emblem +
    `<path transform="translate(${x - w.x1 * sw} ${wordBottom - w.y2 * sw}) scale(${sw})" d="${LOGO.wordmark.d}" fill="${text}"/>` +
    `<path transform="translate(${x - t.x1 * st} ${tagBottom - t.y2 * st}) scale(${st})" d="${LOGO.tagline.d}" fill="${tagColor}"/>` +
    `</svg>\n`
  );
}
