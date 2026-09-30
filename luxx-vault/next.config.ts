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

// PREVIEW_EXPORT=1 builds a static copy for the shareable review preview
// (scripts/build-preview.ts). Static exports can't set headers or optimise images.
const previewExport = process.env.PREVIEW_EXPORT === "1";

const config: NextConfig = previewExport
  ? {
      output: "export",
      reactStrictMode: true,
      images: { unoptimized: true },
    }
  : {
      poweredByHeader: false,
      reactStrictMode: true,
      images: {
        formats: ["image/avif", "image/webp"],
      },
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default config;
