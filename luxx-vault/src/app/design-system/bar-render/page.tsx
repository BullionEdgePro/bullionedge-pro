import type { Metadata } from "next";
import { BarRender } from "./bar-render";

export const metadata: Metadata = { title: "Bar render", robots: { index: false } };

/** Transparent stage used by scripts/screenshot-pages.ts to render the hero's still fallback. */
export default function BarRenderPage() {
  return <BarRender />;
}
