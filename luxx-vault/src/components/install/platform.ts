/**
 * Which install instructions to show: pure user-agent reasoning, tested in
 * platform.test.ts. The browser feature check (`beforeinstallprompt`) is the
 * real authority for the native prompt; this only picks the words and pictures.
 */

export type Os = "ios" | "android" | "macos" | "windows" | "linux" | "chromeos" | "other";
export type Browser = "safari" | "chrome" | "edge" | "samsung" | "firefox" | "opera" | "in-app" | "other";

/** The instruction set to show. */
export type InstallPath =
  | "installed" // already running as the installed app
  | "in-app" // Facebook / Instagram / Messenger / TikTok in-app browser: open in a real browser first
  | "ios-safari" // Share → Add to Home Screen
  | "ios-other" // Chrome/Firefox/Edge on iOS 16.4+: Share → Add to Home Screen, or open in Safari
  | "android-prompt" // Chrome, Edge, Samsung Internet: native install prompt / menu → Install app
  | "android-firefox" // menu → Install
  | "desktop-prompt" // Chrome / Edge on a computer: install icon in the address bar
  | "desktop-safari" // Safari 17+ on a Mac: File → Add to Dock
  | "unsupported"; // e.g. Firefox on a computer

export type Detection = { os: Os; browser: Browser; path: InstallPath };

export type Environment = {
  userAgent: string;
  /** navigator.maxTouchPoints: tells an iPad (which reports a Mac user agent) from a Mac. */
  maxTouchPoints?: number;
  /** display-mode: standalone, or iOS navigator.standalone. */
  standalone?: boolean;
};

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|MessengerLite|Line\/|musical_ly|TikTok|Bytedance|; wv\)/i;

export function detectOs(ua: string, maxTouchPoints = 0): Os {
  if (/iPhone|iPod|iPad/i.test(ua)) return "ios";
  // iPadOS 13+ asks for desktop sites with a Mac user agent; only the touch points give it away.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/CrOS/i.test(ua)) return "chromeos";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macos";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

export function detectBrowser(ua: string): Browser {
  if (IN_APP.test(ua)) return "in-app";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/EdgiOS|EdgA|Edg\//i.test(ua)) return "edge";
  if (/OPR\/|OPiOS|Opera/i.test(ua)) return "opera";
  if (/FxiOS|Firefox\//i.test(ua)) return "firefox";
  if (/CriOS|Chrome\/|Chromium/i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "safari";
  return "other";
}

export function detectInstall(env: Environment): Detection {
  const os = detectOs(env.userAgent, env.maxTouchPoints);
  const browser = detectBrowser(env.userAgent);
  const path = ((): InstallPath => {
    if (env.standalone) return "installed";
    if (browser === "in-app") return "in-app";
    if (os === "ios") return browser === "safari" ? "ios-safari" : "ios-other";
    if (os === "android") {
      // Chrome, Edge, Samsung Internet and Opera all offer "Install app"; so do most other Chromium browsers.
      return browser === "firefox" ? "android-firefox" : "android-prompt";
    }
    if (browser === "chrome" || browser === "edge") return "desktop-prompt";
    if (os === "macos" && browser === "safari") return "desktop-safari";
    return "unsupported";
  })();
  return { os, browser, path };
}

export const BROWSER_NAMES: Record<Browser, string> = {
  safari: "Safari",
  chrome: "Chrome",
  edge: "Edge",
  samsung: "Samsung Internet",
  firefox: "Firefox",
  opera: "Opera",
  "in-app": "an in-app browser",
  other: "this browser",
};
