import type { Metadata, Viewport } from "next";
import { Cinzel, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { ServiceWorkerRegistrar } from "@/components/install/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
import { brand } from "@/config/brand";
import "./globals.css";

/** Display face: headings, prices, product names, wordmark (owner's choice, 30 Sep 2026). */
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

/**
 * Cinzel has no ₱. This one-glyph font (scripts/build-peso-font.ts) supplies a
 * peso sign drawn from Cinzel's P. No generated fallback face: it would cover
 * every other character and hide Cinzel behind it.
 */
const peso = localFont({
  src: [
    { path: "../fonts/luxx-peso-400.otf", weight: "400" },
    { path: "../fonts/luxx-peso-600.otf", weight: "600" },
    { path: "../fonts/luxx-peso-700.otf", weight: "700" },
  ],
  variable: "--font-peso",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

const jakarta = Plus_Jakarta_Sans({
  // latin-ext carries ₱ (U+20B1)
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${brand.siteName} Golds and Diamonds — ${brand.tagline.en}`,
    template: `%s · ${brand.siteName}`,
  },
  description: "Live gold prices in the Philippines, the official Luxx4less store, and a marketplace where every buyer and seller is ID-verified.",
};

export const viewport: Viewport = {
  themeColor: "#17101F",
  // Lets the tab bar sit above the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`dark ${cinzel.variable} ${peso.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
