"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (offline page, last known prices, cached app shell).
 *
 * Production builds only, so the dev server's hot reload is never fighting a
 * cache. To try it in development, run `localStorage.setItem("lx-sw", "on")`
 * in the console and reload; it then registers in "dev" mode (network first
 * for scripts). Turning the flag off unregisters it again.
 *
 * Renders nothing. Mount it once near the root (the lead wires it into the
 * layout); /install, /offline and /tools/hallmark mount it themselves too.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let devFlag = false;
    try {
      devFlag = localStorage.getItem("lx-sw") === "on";
    } catch {
      // storage blocked: behave as unset
    }
    const production = process.env.NODE_ENV === "production";

    if (!production && !devFlag) {
      void navigator.serviceWorker.getRegistrations().then((regs) =>
        regs.filter((r) => r.active?.scriptURL.includes("/sw.js")).forEach((r) => void r.unregister()),
      );
      return;
    }

    const register = () =>
      navigator.serviceWorker
        .register(production ? "/sw.js" : "/sw.js?dev=1", { scope: "/", updateViaCache: "none" })
        .catch((err: unknown) => console.warn("Service worker registration failed", err));

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });
  }, []);
  return null;
}
