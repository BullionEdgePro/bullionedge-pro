/**
 * Hallmark decoder: what the tiny marks stamped inside a ring or on a clasp
 * claim about the metal. Pure (no I/O), shared by /tools/hallmark and tests.
 *
 * A stamp is the maker's claim, not proof. Everything this returns is framed
 * that way, and every decoding ends with the same advice: have it tested.
 */

export type HallmarkMetal = "gold" | "silver" | "platinum" | "palladium";
export type MarkKind = "fineness" | "karat" | "chinese" | "plated" | "filled" | "vermeil" | "origin" | "maker" | "unknown";

export type Reading = {
  metal: HallmarkMetal;
  /** Fraction of pure metal, e.g. 0.75. */
  purity: number;
  /** Gold only: the karat this fineness corresponds to. */
  karat?: number;
};

export type DecodedMark = {
  /** The mark as typed or tapped. */
  input: string;
  kind: MarkKind;
  /** Short heading, e.g. "750 · 18-karat gold". */
  title: string;
  meaning: string;
  /** Possible readings, most likely first. Empty for marks that don't state a purity. */
  readings: Reading[];
  notes: string[];
  /** Set on plated, filled and gilded-silver marks: the piece is not solid gold. */
  warning?: string;
};

export type Colour = "yellow" | "white" | "unknown";

export type Decoding = {
  marks: DecodedMark[];
  /** The best single reading of the whole piece, or null when the marks disagree, are plated, or say nothing about purity. */
  reading: Reading | null;
  /** Solid precious metal isn't claimed (plated, filled, gilded silver). */
  plated: boolean;
  warnings: string[];
  /** Regional context Filipino buyers ask about (Saudi, Japan, Italian, Hong Kong). */
  context: string[];
  summary: string;
  doesNotProve: string[];
};

// ------------------------------------------------------------------ tables

const GOLD_FINENESS: Record<number, { karat: number; note?: string }> = {
  9999: { karat: 24, note: "Four nines: investment-grade bullion (99.99%)." },
  999: { karat: 24 },
  995: { karat: 24, note: "The minimum for London Good Delivery bars." },
  990: { karat: 24, note: "The floor for Chinese 足金 (chuk kam) gold." },
  958: { karat: 23 },
  916: { karat: 22, note: "Often written 916 or 22K; common in Saudi, Indian and Middle Eastern jewellery." },
  900: { karat: 21.6, note: "Japan marks this K21.6; also used for some gold coins." },
  875: { karat: 21, note: "The classic Saudi and Gulf fineness." },
  833: { karat: 20 },
  750: { karat: 18, note: "The world's most common fine-jewellery gold; Italian gold is almost always 750." },
  585: { karat: 14, note: "Strictly 58.3% for 14K; 585 is the rounded-up European mark." },
  583: { karat: 14, note: "Older US and Soviet marking for 14K." },
  500: { karat: 12 },
  417: { karat: 10, note: "The lowest fineness sold as \"gold\" in the United States." },
  416: { karat: 10 },
  375: { karat: 9, note: "Common in the UK and Ireland." },
  333: { karat: 8, note: "Legal \"gold\" in Germany; too low to be called gold in many countries." },
};

const SILVER_FINENESS: Record<number, string> = {
  999: "Fine silver (99.9%). Soft; used for bullion and some jewellery.",
  958: "Britannia silver (95.8%).",
  950: "95% silver, used in France, Mexico and Japan.",
  925: "Sterling silver (92.5%), the standard for silver jewellery.",
  900: "Coin silver (90%).",
  835: "83.5% silver, common in older European pieces.",
  830: "83% silver, common in Scandinavian pieces.",
  800: "80% silver, common in older German and Italian pieces.",
};

const PLATINUM_FINENESS = [999, 950, 900, 850] as const;
const PALLADIUM_FINENESS = [999, 950, 500] as const;

/** Italian provinces that appear most often after the star-and-number maker's mark. */
const ITALIAN_PROVINCES: Record<string, string> = {
  AR: "Arezzo",
  AL: "Alessandria (Valenza)",
  VI: "Vicenza",
  MI: "Milan",
  FI: "Florence",
  NA: "Naples",
  RM: "Rome",
  TO: "Turin",
  VR: "Verona",
  PD: "Padua",
  BS: "Brescia",
  GE: "Genoa",
  VE: "Venice",
  BO: "Bologna",
  CE: "Caserta",
};

const PLATING: Record<string, { name: string; meaning: string; kind: MarkKind }> = {
  GP: { name: "Gold plated", meaning: "A thin layer of gold over a base metal such as brass or copper.", kind: "plated" },
  GEP: { name: "Gold electroplated", meaning: "Gold deposited electrically over a base metal; usually microns thin.", kind: "plated" },
  EP: { name: "Electroplated", meaning: "Plated by electrolysis over a base metal.", kind: "plated" },
  HGE: { name: "Heavy gold electroplate", meaning: "A thicker electroplate, still over a base metal. Not solid gold.", kind: "plated" },
  HGP: { name: "Heavy gold plated", meaning: "A thicker plate, still over a base metal. Not solid gold.", kind: "plated" },
  RGP: { name: "Rolled gold plate", meaning: "A thin sheet of gold bonded to a base metal; thinner than gold-filled.", kind: "plated" },
  RG: { name: "Rolled gold", meaning: "A sheet of gold bonded to a base metal.", kind: "plated" },
  GS: { name: "Gold shell", meaning: "A gold skin over a base-metal core.", kind: "plated" },
  GF: { name: "Gold filled", meaning: "A layer of gold (by US rules at least 1/20 of the weight) bonded to a base-metal core.", kind: "filled" },
  GO: { name: "Gold overlay", meaning: "A gold layer over a base metal.", kind: "plated" },
  KGP: { name: "Karat gold plated", meaning: "Plated with karat gold over a base metal.", kind: "plated" },
};

// ------------------------------------------------------------------ helpers

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Arabic-Indic and Persian digits (common on Saudi and Gulf pieces) → 0–9; full-width → ASCII; ☆/✩/✱ → ★. */
export function normaliseMarkText(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[☆✩✪✫✬✭✮✯✰✱✲✳*＊]/g, "★")
    .replace(/[，、；;|]/g, " ")
    .trim();
}

const hadArabicDigits = (text: string) => /[٠-٩۰-۹]/.test(text);

function pct(purity: number): string {
  return `${(purity * 100).toFixed(purity >= 0.99 ? 2 : 1).replace(/\.0$/, "")}%`;
}

function goldReading(fineness: number): Reading {
  const row = GOLD_FINENESS[fineness];
  return { metal: "gold", purity: (fineness >= 1000 ? fineness / 10000 : fineness / 1000), karat: row?.karat };
}

/** Karat → fineness as marked (24K is quoted at 999, as on /prices). */
export function karatToPurity(karat: number): number {
  const table: Record<number, number> = { 24: 0.999, 23: 0.958, 22: 0.916, 21: 0.875, 20: 0.833, 18: 0.75, 14: 0.585, 12: 0.5, 10: 0.417, 9: 0.375, 8: 0.333 };
  return table[karat] ?? Math.min(karat / 24, 0.999);
}

// ------------------------------------------------------------------ tokenising

/**
 * Split the typed marks into tokens, keeping multi-word marks together:
 * "1/20 12K GF", "18K GP", "Pt 950", "★ 1234 AR".
 */
export function tokenise(text: string): string[] {
  let s = normaliseMarkText(text);
  // Glue prefixes to their numbers: "Pt 950" → "Pt950", "Au 750" → "Au750", "K 18" → "K18", "S 925" → "S925".
  s = s.replace(/\b(Pt|PT|pt|Pd|PD|pd|Au|AU|au|K|k|S|s)\s+(\d{2,4}(?:\.\d)?)\b/g, "$1$2");
  // Glue a karat to its unit: "18 K" → "18K", "18 kt" → "18kt".
  s = s.replace(/\b(\d{1,2})\s+(k|kt|kp|karat|carat|ct|c)\b/gi, "$1$2");
  // Fraction-filled marks: "1/20 12K GF", "1/10 14KT G.F."
  s = s.replace(/\b(\d{1,2}\s*\/\s*\d{1,3})\s+(\d{1,2}\s*k[t]?)\s*(g\.?\s?f\.?|r\.?g\.?p\.?)/gi, (_m, f: string, k: string, t: string) =>
    `${f.replace(/\s/g, "")}_${k.replace(/\s/g, "")}_${t.replace(/[.\s]/g, "")}`,
  );
  // Plating after a karat: "18K GP", "14K HGE", "24K G.P." → one token.
  s = s.replace(/\b(\d{1,2}\s*k[t]?)\s*[-\s]?\s*(h\.?g\.?e\.?|h\.?g\.?p\.?|g\.?e\.?p\.?|r\.?g\.?p\.?|g\.?p\.?|g\.?f\.?|e\.?p\.?)(?=\s|$)/gi, (_m, k: string, t: string) =>
    `${k.replace(/\s/g, "")}_${t.replace(/[.\s]/g, "")}`,
  );
  // Dotted abbreviations on their own: "G.F." → "GF".
  s = s.replace(/\b((?:[a-z]\.){2,4})(?=\s|$)/gi, (m) => m.replace(/\./g, ""));
  // Chinese marks are often run together with numbers: "足金999" → "足金 999", "18K金" stays.
  s = s.replace(/(千足金|万足金|足金|足銀|足银|铂|鉑)(\d{3,4})/g, "$1 $2");
  return s.split(/\s+/).filter(Boolean);
}

// ------------------------------------------------------------------ one mark

function decodeToken(raw: string, colour: Colour, all: string[]): DecodedMark {
  const t = raw.trim();
  const up = t.toUpperCase();

  // Chinese purity words
  if (t === "千足金" || t === "万足金") {
    const purity = t === "万足金" ? 0.9999 : 0.999;
    return {
      input: t,
      kind: "chinese",
      title: `${t} · ${t === "万足金" ? "man chuk kam" : "chin chuk kam"} (${pct(purity)} gold)`,
      meaning: `Chinese standard for gold of at least ${pct(purity)} purity: the highest grade sold in Hong Kong and mainland shops.`,
      readings: [{ metal: "gold", purity, karat: 24 }],
      notes: ["Very soft: 24-karat pieces scratch and bend easily, so they're usually plain bangles, chains and pendants."],
    };
  }
  if (t === "足金") {
    return {
      input: t,
      kind: "chinese",
      title: "足金 · chuk kam (at least 99.0% gold)",
      meaning: "Chinese standard meaning “full gold”: at least 99.0% pure. This is the Hong Kong gold Filipino buyers call “chuk kam”.",
      readings: [{ metal: "gold", purity: 0.99, karat: 24 }],
      notes: ["Priced in Hong Kong by the tael (37.43 g) and sold with the weight, not a fixed price. Often paired with 999 or 999.9."],
    };
  }
  if (t === "金" || /^\d{1,2}K金$/i.test(t)) {
    const k = /^(\d{1,2})K金$/i.exec(t);
    if (k) return karatMark(t, Number(k[1]), colour, [`“金” is Chinese for gold; ${k[1]}K金 is ${k[1]}-karat gold.`]);
    return { input: t, kind: "chinese", title: "金 · gold", meaning: "Chinese for “gold”. On its own it doesn't state a purity.", readings: [], notes: [] };
  }
  if (t === "足銀" || t === "足银" || t === "银" || t === "銀") {
    return { input: t, kind: "chinese", title: `${t} · silver`, meaning: "Chinese mark for silver (足银: at least 99.0% silver).", readings: t.startsWith("足") ? [{ metal: "silver", purity: 0.99 }] : [], notes: [] };
  }
  if (t === "铂" || t === "鉑") {
    return { input: t, kind: "chinese", title: `${t} · platinum`, meaning: "Chinese for platinum; the number beside it gives the purity (e.g. 铂950).", readings: [], notes: [] };
  }

  // Vermeil and "sterling"
  if (/^VERMEIL$/.test(up)) {
    return {
      input: t,
      kind: "vermeil",
      title: "Vermeil · gold over sterling silver",
      meaning: "Sterling silver with a gold layer (in the US at least 10K and 2.5 microns thick).",
      readings: [{ metal: "silver", purity: 0.925 }],
      notes: ["Its value is the silver, not the gold."],
      warning: "Vermeil is gilded silver, not solid gold.",
    };
  }
  if (/^(STERLING|STER|STG)$/.test(up)) return silverMark(t, 925, colour, ["“Sterling” is the word mark for 92.5% silver."]);

  // Fraction gold-filled / rolled plate: 1/20_12K_GF
  const filled = /^(\d{1,2}\/\d{1,3})_(\d{1,2})KT?_(GF|RGP)$/i.exec(t);
  if (filled) {
    const [, frac, k, type] = filled;
    const [num, den] = frac!.split("/").map(Number);
    const layer = num! / den!;
    const goldShare = layer * karatToPurity(Number(k));
    const isGF = type!.toUpperCase() === "GF";
    return {
      input: t.replace(/_/g, " "),
      kind: isGF ? "filled" : "plated",
      title: `${frac} ${k}K ${isGF ? "GF · gold filled" : "RGP · rolled gold plate"}`,
      meaning: `${frac} of the weight is a ${k}-karat gold layer; the rest is base metal. That's about ${pct(goldShare)} gold by weight in total.`,
      readings: [],
      notes: ["Gold-filled wears far better than plating, but it's priced as costume jewellery, not by the gram."],
      warning: `${isGF ? "Gold filled" : "Rolled gold plate"}: a gold layer on base metal, not solid gold.`,
    };
  }

  // Karat + plating: 18K_GP, 14K_HGE
  const kPlated = /^(\d{1,2})KT?_([A-Z]+)$/i.exec(t);
  if (kPlated) {
    const code = kPlated[2]!.toUpperCase();
    const p = PLATING[code];
    return {
      input: t.replace(/_/g, " "),
      kind: p?.kind ?? "plated",
      title: `${kPlated[1]}K ${code} · ${p?.name.toLowerCase() ?? "plated"}`,
      meaning: `The ${kPlated[1]}K describes the thin gold layer only. ${p?.meaning ?? ""}`.trim(),
      readings: [],
      notes: ["The most common way plated pieces pass as gold: people read the “18K” and miss the letters after it."],
      warning: `${p?.name ?? "Plated"}: not solid gold, whatever the karat number says.`,
    };
  }

  // Plating on its own
  const plating = PLATING[up.replace(/\./g, "")];
  if (plating) {
    return {
      input: t,
      kind: plating.kind,
      title: `${up} · ${plating.name.toLowerCase()}`,
      meaning: plating.meaning,
      readings: [],
      notes: [],
      warning: `${plating.name}: not solid gold. Any karat stamped beside it describes the layer only.`,
    };
  }

  // Japanese-style karat: K18, K24, K21.6, K18WG, K14
  const kPrefix = /^K(\d{1,2}(?:\.\d)?)(WG|PG|YG)?$/i.exec(t);
  if (kPrefix) {
    const k = Number(kPrefix[1]);
    return karatMark(t, k, colour, [
      "The K-first style (K18, K24) is how Japanese jewellery is marked; it's what Filipino buyers call “Japan gold”.",
      ...(kPrefix[2] ? [`${kPrefix[2].toUpperCase()} = ${kPrefix[2].toUpperCase() === "WG" ? "white" : kPrefix[2].toUpperCase() === "PG" ? "pink" : "yellow"} gold.`] : []),
    ]);
  }

  // Karat: 18K, 18KT, 18CT, 18 karat, 18KP (plumb), 22C
  const kSuffix = /^(\d{1,2})(K|KT|KP|CT|C|KARAT|CARAT)$/i.exec(t);
  if (kSuffix) {
    const notes: string[] = [];
    const unit = kSuffix[2]!.toUpperCase();
    if (unit === "KP") notes.push("KP means “karat plumb”: the gold content is at least the stated karat, with no under-karat tolerance (a US mark).");
    if (unit === "CT" || unit === "C") notes.push("CT/C for karat is British and Indian usage (not to be confused with ct for diamond carats).");
    if (unit === "KT") notes.push("KT is simply another way to write karat.");
    return karatMark(t, Number(kSuffix[1]), colour, notes);
  }

  // Au750, AU999 (Chinese national standard)
  const au = /^AU(\d{3,4})$/i.exec(t);
  if (au) {
    const n = Number(au[1]);
    const r = goldReading(n);
    return {
      input: t,
      kind: "fineness",
      title: `Au${n} · ${pct(r.purity)} gold${r.karat ? ` (${r.karat}K)` : ""}`,
      meaning: `“Au” is the chemical symbol for gold; ${n} is parts per ${n >= 1000 ? "ten thousand" : "thousand"}. This is the Chinese and Hong Kong way of marking karat gold.`,
      readings: [r],
      notes: [],
    };
  }

  // Platinum / palladium with prefix: Pt950, PT900, Pd500
  const ptpd = /^(PT|PD)(\d{3})$/i.exec(t);
  if (ptpd) {
    const metal: HallmarkMetal = ptpd[1]!.toUpperCase() === "PT" ? "platinum" : "palladium";
    const n = Number(ptpd[2]);
    const known = (metal === "platinum" ? PLATINUM_FINENESS : PALLADIUM_FINENESS).includes(n as never);
    return {
      input: t,
      kind: "fineness",
      title: `${metal === "platinum" ? "Pt" : "Pd"}${n} · ${pct(n / 1000)} ${metal}`,
      meaning: `${metal === "platinum" ? "Pt" : "Pd"} is the chemical symbol for ${metal}; ${n} is parts per thousand.`,
      readings: [{ metal, purity: n / 1000 }],
      notes: [
        ...(metal === "platinum" && (n === 900 || n === 850) ? ["Pt900 and Pt850 are the classic Japanese platinum grades."] : []),
        ...(metal === "palladium" && n === 500 ? ["Pd500 is legal in some markets but is half palladium; value it accordingly."] : []),
        ...(!known ? ["An unusual fineness for this metal; check it carefully."] : []),
        ...(metal === "platinum" ? ["White gold is often confused with platinum: platinum is much heavier for its size."] : []),
      ],
    };
  }

  // Silver with prefix/suffix: S925, 925S, SS925
  const sPrefixed = /^(?:S|SS|AG)(\d{3})$|^(\d{3})(?:S|AG)$/i.exec(t);
  if (sPrefixed) return silverMark(t, Number(sPrefixed[1] ?? sPrefixed[2]), colour, ["The S (or Ag, silver's chemical symbol) marks it as silver."]);

  // Plain fineness numbers: 999, 999.9, 9999, 916, 750, 925 …
  const num = /^(\d{3,4})(?:\.(\d))?$/.exec(t);
  if (num) {
    const n = num[2] != null ? Number(num[1]) * 10 + Number(num[2]) : Number(num[1]);
    if (all.includes("★") && !GOLD_FINENESS[n] && !SILVER_FINENESS[n] && n !== 999 && n !== 9999) {
      return { input: t, kind: "origin", title: `${t} · Italian maker's number`, meaning: "The registered maker's number from Italy's star mark, not a purity.", readings: [], notes: [] };
    }
    // 999.9 is written with a point; 9999 without.
    return finenessMark(t, n, colour, all);
  }

  // A bare karat number ("21", Arabic ٢١): the usual Saudi and Gulf marking.
  const bare = /^(\d{1,2})$/.exec(t);
  if (bare && !all.includes("★")) {
    const k = Number(bare[1]);
    if (k >= 8 && k <= 24) {
      return karatMark(t, k, colour, [`A bare ${k} is read as the karat; Saudi and Gulf pieces are often stamped this way, sometimes in Arabic numerals.`]);
    }
  }

  // Italian maker's mark pieces
  if (t === "★") {
    return {
      input: t,
      kind: "origin",
      title: "★ · Italian maker's mark (star)",
      meaning: "Italy's registered-maker mark is a five-point star, a number and a two-letter province code, e.g. ★ 1234 AR, beside the fineness (usually 750).",
      readings: [],
      notes: ["The number identifies the registered maker in that province; it isn't a purity."],
    };
  }
  const italian = /^(\d{1,5})([A-Z]{2})$/.exec(up);
  if (italian && ITALIAN_PROVINCES[italian[2]!]) {
    return {
      input: t,
      kind: "origin",
      title: `${italian[1]} ${italian[2]} · Italian maker no. ${italian[1]}, ${ITALIAN_PROVINCES[italian[2]!]}`,
      meaning: `The registered maker's number (${italian[1]}) and province (${italian[2]} = ${ITALIAN_PROVINCES[italian[2]!]}) from Italy's star mark.`,
      readings: [],
      notes: ["Arezzo, Vicenza and Valenza are Italy's great gold-chain and jewellery centres."],
    };
  }
  if (ITALIAN_PROVINCES[up] && all.some((a) => a === "★" || /^\d{1,5}$/.test(a))) {
    return {
      input: t,
      kind: "origin",
      title: `${up} · ${ITALIAN_PROVINCES[up]} (Italian province code)`,
      meaning: `Part of Italy's star maker's mark: the province where the maker is registered.`,
      readings: [],
      notes: [],
    };
  }
  if (/^ITALY|ITALIA$/.test(up)) {
    return { input: t, kind: "origin", title: `${t} · country of manufacture`, meaning: "Says where it was made; says nothing about purity on its own.", readings: [], notes: [] };
  }
  if (/^\d{1,5}$/.test(t) && all.includes("★")) {
    return { input: t, kind: "origin", title: `${t} · Italian maker's number`, meaning: "The registered maker's number from Italy's star mark, not a purity.", readings: [], notes: [] };
  }

  // Letters we don't know: a maker's or shop mark
  if (/^[\p{L}&.'-]{1,12}$/u.test(t)) {
    return {
      input: t,
      kind: "maker",
      title: `${t} · maker's or shop mark`,
      meaning: "Letters or a logo usually identify the maker or the shop that sold the piece. They don't state purity.",
      readings: [],
      notes: [],
    };
  }

  return { input: t, kind: "unknown", title: `${t} · not recognised`, meaning: "We don't recognise this mark. Check you've read it correctly under good light, or ask an appraiser.", readings: [], notes: [] };
}

function karatMark(input: string, karat: number, colour: Colour, notes: string[]): DecodedMark {
  if (karat < 1 || karat > 24) {
    return { input, kind: "unknown", title: `${input} · not a real karat`, meaning: "Gold is measured from 1 to 24 karats; this number is outside that range.", readings: [], notes: [] };
  }
  const purity = karatToPurity(karat);
  const extra: string[] = [];
  if (karat === 24) extra.push("24K is as pure as gold jewellery gets: soft, deep yellow, and usually marked 999 or 999.9 as well.");
  if (karat === 21) extra.push("21K (875) is the classic “Saudi gold” fineness.");
  if (karat === 18) extra.push("18K (750) is the global fine-jewellery standard: Italian, Japan and Saudi pieces all use it.");
  if (karat < 10) extra.push("Below 10K many countries don't allow the piece to be called gold at all.");
  return {
    input,
    kind: "karat",
    title: `${input} · ${karat}-karat gold (${pct(purity)})`,
    meaning: `${karat} parts gold out of 24, about ${pct(purity)} pure gold; the rest is alloy (silver, copper, zinc or palladium) that sets the colour and hardness.`,
    readings: [{ metal: "gold", purity, karat }],
    notes: [...notes, ...extra, ...(colour === "white" ? ["On a white piece this is white gold: gold alloyed with palladium or nickel, usually rhodium-plated."] : [])],
  };
}

function silverMark(input: string, fineness: number, colour: Colour, notes: string[]): DecodedMark {
  const desc = SILVER_FINENESS[fineness] ?? `${pct(fineness / 1000)} silver.`;
  const gilded = colour === "yellow";
  return {
    input,
    kind: "fineness",
    title: `${input} · silver (${pct(fineness / 1000)})`,
    meaning: desc,
    readings: [{ metal: "silver", purity: fineness / 1000 }],
    notes,
    warning: gilded ? `A ${fineness} mark on a gold-coloured piece means gilded silver (silver with a gold layer), not gold.` : undefined,
  };
}

function finenessMark(input: string, n: number, colour: Colour, all: string[]): DecodedMark {
  const hasPlating = all.some((a) => /_|^(GP|GEP|HGE|HGP|RGP|GF|EP|RG|GS|GO|KGP)$/i.test(a.replace(/\./g, "")));

  // Silver-only numbers
  if (n === 925 || n === 958 || n === 800 || n === 835 || n === 830) {
    const notes = n === 958 ? ["958 is also 23K gold; on a yellow, heavy piece ask for a test to tell which."] : [];
    if (n === 958 && colour === "yellow") {
      return {
        input,
        kind: "fineness",
        title: "958 · 23-karat gold, or Britannia silver",
        meaning: "On a gold-coloured piece 958 most likely means 23-karat gold (95.8%); on a white piece it's Britannia silver.",
        readings: [goldReading(958), { metal: "silver", purity: 0.958 }],
        notes: [],
      };
    }
    return silverMark(input, n, colour, notes);
  }

  // Gold fineness
  const gold = GOLD_FINENESS[n];
  const readings: Reading[] = [];
  const notes: string[] = [];
  let title: string;
  let meaning: string;

  const pureLike = n === 999 || n === 9999 || n === 995 || n === 990;
  if (pureLike) {
    const g = goldReading(n);
    const s: Reading = { metal: "silver", purity: n >= 1000 ? n / 10000 : n / 1000 };
    if (colour === "white") {
      readings.push(s);
      notes.push("Platinum this pure is normally marked Pt999; a bare number on a white piece is usually fine silver.");
    }
    else if (colour === "yellow") readings.push(g);
    else readings.push(g, s);
    const shown = input.includes(".") ? input : n >= 1000 ? "999.9" : String(n);
    title = colour === "white" ? `${shown} · fine silver (${pct(s.purity)})` : colour === "yellow" ? `${shown} · pure gold (${pct(g.purity)})` : `${shown} · ${pct(g.purity)} pure`;
    meaning =
      colour === "unknown"
        ? `Parts per ${n >= 1000 ? "ten thousand" : "thousand"}: ${pct(g.purity)} pure metal. On a yellow piece it's 24-karat gold; on a white piece it's fine silver (or platinum, which is usually marked Pt999).`
        : `Parts per ${n >= 1000 ? "ten thousand" : "thousand"}: ${pct(g.purity)} pure metal.`;
    if (gold?.note) notes.push(gold.note);
    if (n === 9999 || input === "999.9") notes.push("Hong Kong and Chinese 24K is often stamped 999.9 alongside 足金 or 千足金.");
  } else if (n === 950) {
    readings.push({ metal: "platinum", purity: 0.95 }, { metal: "palladium", purity: 0.95 }, { metal: "silver", purity: 0.95 });
    title = "950 · platinum, palladium or silver (95%)";
    meaning = "A bare 950 is ambiguous: platinum is normally marked Pt950 and palladium Pd950, and 950 silver is used in France, Mexico and Japan.";
    notes.push("Platinum is far heavier than silver for its size; an appraiser can tell them apart in seconds.");
  } else if (n === 900) {
    if (colour === "white") readings.push({ metal: "platinum", purity: 0.9 }, { metal: "silver", purity: 0.9 });
    else readings.push(goldReading(900), { metal: "silver", purity: 0.9 });
    title = colour === "white" ? "900 · platinum or coin silver (90%)" : "900 · 90% gold (21.6K), or coin silver";
    meaning = "900 means 90% pure. On a yellow piece it's 21.6-karat gold (Japan marks it K21.6); on a white piece it's usually Pt900 platinum or coin silver.";
  } else if (n === 500) {
    readings.push({ metal: "palladium", purity: 0.5 }, goldReading(500));
    title = "500 · 50% palladium, or 12-karat gold";
    meaning = "Usually Pd500 palladium; rarely 12-karat gold.";
  } else if (gold) {
    readings.push(goldReading(n));
    title = `${input} · ${gold.karat}-karat gold (${pct(n / 1000)})`;
    meaning = `Parts per thousand: ${pct(n / 1000)} pure gold, the European way of writing ${gold.karat}K.`;
    if (gold.note) notes.push(gold.note);
    if (n === 833) notes.push("833 is also a Portuguese silver standard; on a white piece ask which.");
    if (n === 875) notes.push("875 on a white piece can be Russian 875 silver.");
    if (colour === "white" && (n === 750 || n === 585 || n === 375)) notes.push("On a white piece this is white gold, usually rhodium-plated.");
  } else {
    return {
      input,
      kind: "unknown",
      title: `${input} · unusual number`,
      meaning: "Not a standard fineness. It could be a maker's number, a model number or a worn stamp; read it again under a light.",
      readings: [],
      notes: [],
    };
  }

  return {
    input,
    kind: "fineness",
    title,
    meaning,
    readings,
    notes,
    warning: hasPlating && readings[0]?.metal === "gold" ? "Beside a plating mark, this number describes the plating, not the piece." : undefined,
  };
}

// ------------------------------------------------------------------ whole piece

export const DOES_NOT_PROVE = [
  "That the piece is genuine: stamps are cheap to fake, and fake-stamped plated pieces are common in the Philippines.",
  "That the whole piece is that purity: the stamp may be on a clasp, jump ring or tag that was added later.",
  "Its weight, or that it's solid: hollow pieces and heavy solder change the gold content.",
  "Where it came from: “Saudi”, “Japan” and “Italian” describe a style and a usual fineness, not a certified origin.",
];

const CONTEXT = {
  saudi:
    "Saudi gold: usually 21K (875) or 18K (750), sometimes 22K (916), often stamped with Arabic numerals (٢١ = 21, ٨٧٥ = 875). Bright yellow and machine-made; prized in the Philippines for its colour.",
  japan:
    "Japan gold: marked K-first (K18, K24) and platinum as Pt900 or Pt850. Genuine assayed pieces may carry the Japan Mint hallmark (a flag with a diamond), but most Japanese jewellery has only the maker's stamp.",
  italian:
    "Italian gold: almost always 750 (18K), with a star, a maker's number and a province code (★ 1234 AR). Chains from Arezzo and Vicenza are the classics.",
  hongkong:
    "Hong Kong gold: 足金 (at least 99.0%) or 千足金 (at least 99.9%), often with 999.9 and the shop's name. Bought by weight, so the shop's receipt with the weight matters.",
};

export function decodeHallmarks(text: string, colour: Colour = "unknown"): Decoding {
  const tokens = tokenise(text);
  const marks = tokens.map((t) => decodeToken(t, colour, tokens));
  const warnings = [...new Set(marks.flatMap((m) => (m.warning ? [m.warning] : [])))];
  const plated = marks.some((m) => m.kind === "plated" || m.kind === "filled" || m.kind === "vermeil") || (colour === "yellow" && marks.some((m) => m.readings[0]?.metal === "silver" && m.kind === "fineness"));
  if (plated && marks.some((m) => m.kind === "karat" || (m.kind === "fineness" && m.readings[0]?.metal === "gold"))) {
    warnings.push("A karat or fineness number next to a plating mark describes the thin layer only. Value the piece as plated.");
  }

  const context: string[] = [];
  const has = (re: RegExp) => marks.some((m) => re.test(m.input));
  if (hadArabicDigits(text) || has(/^(21K?|875)$/i)) context.push(CONTEXT.saudi);
  if (has(/^K\d/i) || has(/^PT(900|850)$/i)) context.push(CONTEXT.japan);
  if (has(/^★$/) || marks.some((m) => m.kind === "origin" && /Italian/.test(m.title))) context.push(CONTEXT.italian);
  if (marks.some((m) => m.kind === "chinese") || has(/^(999\.9|9999|AU\d+)$/i)) context.push(CONTEXT.hongkong);

  // Best single reading: every purity-bearing mark must agree on metal; take the highest-confidence (first) reading.
  const purityMarks = marks.filter((m) => m.readings.length > 0 && m.kind !== "vermeil");
  let reading: Reading | null = null;
  if (!plated && purityMarks.length) {
    const firsts = purityMarks.map((m) => m.readings[0]!);
    const metals = new Set(firsts.map((r) => r.metal));
    if (metals.size === 1) {
      // Prefer an unambiguous mark (one reading) over an ambiguous one.
      const unambiguous = purityMarks.find((m) => m.readings.length === 1);
      // Only ambiguous marks (a bare 999 with no colour given): don't guess the metal.
      reading = unambiguous ? unambiguous.readings[0]! : null;
      const purities = new Set(firsts.map((r) => r.purity.toFixed(3)));
      if (reading && purities.size > 1) {
        // 999 + 999.9 + 足金 all mean "24K"; anything else disagreeing is worth flagging.
        const karats = new Set(firsts.map((r) => r.karat ?? r.purity));
        if (karats.size > 1) warnings.push("These marks claim different purities. That happens with replaced clasps and with fakes; have it tested.");
        // Use the lowest claimed purity: never overstate value.
        reading = firsts.reduce((lo, r) => (r.purity < lo.purity ? r : lo));
      }
    } else {
      warnings.push("These marks point to different metals. Tell us the colour of the piece, or have it tested.");
    }
  }

  let summary: string;
  if (!marks.length) summary = "Type or tap the marks you can see.";
  else if (plated) summary = "The marks say this piece is plated, filled or gilded: not solid gold. Don't pay a per-gram gold price for it.";
  else if (reading)
    summary = `The marks claim ${reading.metal === "gold" && reading.karat ? `${reading.karat}-karat gold` : reading.metal} at about ${pct(reading.purity)} purity.`;
  else if (purityMarks.length) summary = "The marks state a purity, but more than one reading fits. Choose the piece's colour to narrow it down.";
  else summary = "None of these marks states a purity. Look for a number (such as 750 or 916) or a karat (such as 18K).";

  return { marks, reading, plated, warnings, context, summary, doesNotProve: DOES_NOT_PROVE };
}

/** Stamps offered as one-tap buttons, in the order a buyer is likely to meet them. */
export const COMMON_STAMPS = [
  "999.9", "999", "990", "916", "875", "750", "585", "417", "375",
  "24K", "22K", "21K", "18K", "14K", "10K", "K18", "K24", "18KT",
  "足金", "千足金", "Au750",
  "925", "958", "800", "Pt950", "Pt900", "Pt850", "Pd950",
  "★", "GP", "GF", "HGE", "RGP", "18K GP", "vermeil",
] as const;
