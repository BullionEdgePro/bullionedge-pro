"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    // Dark only, by the owner's choice (30 Sep 2026): the velvet vault is the brand.
    <NextThemes attribute="class" forcedTheme="dark" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
