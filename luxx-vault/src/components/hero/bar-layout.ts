// Shared by the hero (DOM) and the 3D scene. Kept apart from gold-bar.tsx so
// importing it doesn't pull three.js into the main bundle.
import type { RefObject } from "react";

/**
 * Where the bar should sit, as fractions of the canvas (0 = top/left edge,
 * 1 = bottom/right): the free zone between the numerals and the controls,
 * and where it settles at the end of the scroll. Written by the hero on resize.
 */
export interface BarLayout {
  zoneCenterY: number;
  zoneHeight: number;
  zoneWidth: number;
  settleCenterY: number;
}
export type LayoutRef = RefObject<BarLayout>;
export const CENTERED: BarLayout = { zoneCenterY: 0.5, zoneHeight: 0.6, zoneWidth: 0.7, settleCenterY: 0.6 };
