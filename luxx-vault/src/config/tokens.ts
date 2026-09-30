/**
 * Colour tokens. globals.css mirrors these as CSS variables; tokens.test.ts
 * checks every pairing listed in `pairings` meets WCAG AA for its use.
 */
import type { ContrastUse } from "@/lib/contrast";

/** Brand palette from the brief, plus derived shades where the brief's colour fails AA as text. */
export const palette = {
  velvet: "#17101F",
  velvetRaised: "#221830",
  velvetLine: "#3A2D4A",
  champagne: "#D6B26E",
  bullion: "#A8823F",
  /** Derived: gold for small text on light surfaces (bullion is 3.1:1 on pearl — large text only). */
  bullionInk: "#7A5B22",
  pearl: "#EEF0F3",
  pearlRaised: "#FFFFFF",
  pearlLine: "#D5D8DE",
  ice: "#BFD8E4",
  /** Derived: focus ring on light surfaces (ice is 1.3:1 on pearl). */
  iceDeep: "#2F6F8A",
  ink: "#1C1A22",
  inkMuted: "#55505E",
  mist: "#F3EEF6",
  mistMuted: "#B8AEC4",
  success: "#3E9B6E",
  warning: "#D89A2B",
  danger: "#C2453D",
  /** Derived: status text on light. */
  successInk: "#23704B",
  warningInk: "#855607",
  dangerInk: "#A3322B",
  /** Derived: status text on dark. */
  successGlow: "#6CC79A",
  warningGlow: "#E9B55A",
  dangerGlow: "#EE8078",
} as const;

export type PaletteKey = keyof typeof palette;

/** Semantic roles per theme — what components actually use. */
export const themes = {
  light: {
    bg: palette.pearl,
    surface: palette.pearlRaised,
    line: palette.pearlLine,
    text: palette.ink,
    muted: palette.inkMuted,
    gold: palette.bullionInk,
    goldLarge: palette.bullion,
    ring: palette.iceDeep,
    success: palette.successInk,
    warning: palette.warningInk,
    danger: palette.dangerInk,
  },
  dark: {
    bg: palette.velvet,
    surface: palette.velvetRaised,
    line: palette.velvetLine,
    text: palette.mist,
    muted: palette.mistMuted,
    gold: palette.champagne,
    goldLarge: palette.champagne,
    ring: palette.ice,
    success: palette.successGlow,
    warning: palette.warningGlow,
    danger: palette.dangerGlow,
  },
} as const;

type Role = keyof (typeof themes)["light"];

/** Every foreground/background pairing the UI uses, and what it's used for. */
export const pairings: { fg: Role; bg: "bg" | "surface"; use: ContrastUse }[] = [
  { fg: "text", bg: "bg", use: "text" },
  { fg: "text", bg: "surface", use: "text" },
  { fg: "muted", bg: "bg", use: "text" },
  { fg: "muted", bg: "surface", use: "text" },
  { fg: "gold", bg: "bg", use: "text" },
  { fg: "gold", bg: "surface", use: "text" },
  { fg: "goldLarge", bg: "bg", use: "large" },
  { fg: "ring", bg: "bg", use: "ui" },
  { fg: "ring", bg: "surface", use: "ui" },
  { fg: "success", bg: "surface", use: "text" },
  { fg: "warning", bg: "surface", use: "text" },
  { fg: "danger", bg: "surface", use: "text" },
];

/** Text on the gold button — velvet on both ends of the gradient. */
export const onGold = { fg: palette.velvet, bgs: [palette.champagne, palette.bullion] } as const;
