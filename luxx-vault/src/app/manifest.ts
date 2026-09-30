import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/**
 * Web app manifest (served at /manifest.webmanifest): what makes Luxx4less
 * installable. Icons are the existing brand icons from `npm run brand:icons`;
 * the 512px one keeps the emblem inside the maskable safe zone (checked by
 * eye: the star's points sit within the central 80% circle), so it doubles as
 * the maskable icon on a full-bleed velvet ground.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: brand.siteName,
    short_name: brand.siteName,
    description: "Live gold prices in the Philippines, price alerts, the hallmark reader and the official Luxx4less store.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17101F",
    theme_color: "#17101F",
    lang: "en-PH",
    dir: "ltr",
    categories: ["shopping", "finance", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Today's prices", short_name: "Prices", url: "/prices", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Price alerts", short_name: "Alerts", url: "/account/alerts", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Hallmark reader", short_name: "Hallmarks", url: "/tools/hallmark", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
