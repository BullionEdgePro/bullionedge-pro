import { describe, expect, it } from "vitest";
import { detectInstall } from "./platform";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.7258.76 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  iphoneFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 [FBAN/FBIOS;FBAV/520.0.0.38.101;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBLC/en_US;FBOP/5]",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0",
  androidMessenger:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/139.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0.0.0;]",
  androidInstagram:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/139.0.0.0 Mobile Safari/537.36 Instagram 390.0.0.0",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
};

describe("detectInstall", () => {
  it.each([
    ["iphoneSafari", 5, "ios", "safari", "ios-safari"],
    ["iphoneChrome", 5, "ios", "chrome", "ios-other"],
    ["ipadDesktopMode", 5, "ios", "safari", "ios-safari"],
    ["iphoneFacebook", 5, "ios", "in-app", "in-app"],
    ["androidChrome", 5, "android", "chrome", "android-prompt"],
    ["androidSamsung", 5, "android", "samsung", "android-prompt"],
    ["androidFirefox", 5, "android", "firefox", "android-firefox"],
    ["androidMessenger", 5, "android", "in-app", "in-app"],
    ["androidInstagram", 5, "android", "in-app", "in-app"],
    ["windowsChrome", 0, "windows", "chrome", "desktop-prompt"],
    ["windowsEdge", 0, "windows", "edge", "desktop-prompt"],
    ["macSafari", 0, "macos", "safari", "desktop-safari"],
    ["macChrome", 0, "macos", "chrome", "desktop-prompt"],
    ["chromebook", 0, "chromeos", "chrome", "desktop-prompt"],
    ["windowsFirefox", 0, "windows", "firefox", "unsupported"],
  ] as const)("%s", (key, touch, os, browser, path) => {
    expect(detectInstall({ userAgent: UA[key], maxTouchPoints: touch })).toEqual({ os, browser, path });
  });

  it("a Mac with no touch screen is a Mac, not an iPad", () => {
    expect(detectInstall({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 0 }).os).toBe("macos");
  });

  it("already installed wins over everything", () => {
    expect(detectInstall({ userAgent: UA.androidChrome, standalone: true }).path).toBe("installed");
  });

  it("copes with an empty user agent", () => {
    expect(detectInstall({ userAgent: "" })).toEqual({ os: "other", browser: "other", path: "unsupported" });
  });
});
