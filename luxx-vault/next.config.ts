import type { NextConfig } from "next";

// Baseline headers. The strict nonce-based CSP lands in Phase 9 once every
// third-party (payments, KYC, chat) is known; camera is opened only on /verify
// in Phase 5.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be served stale, or an update could strand installed apps.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      // Brief §11: the camera opens only where identity is verified (ID photos, the selfie and the face re-check),
      // and on the hallmark reader, where the camera is how a stamp gets photographed.
      {
        source: "/(account/verification|account/face-check|tools/hallmark)(.*)",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" }],
      },
    ];
  },
};

export default config;
