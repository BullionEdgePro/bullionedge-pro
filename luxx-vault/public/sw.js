/*
 * Luxx4less service worker: a small, honest offline layer.
 *
 * - Pages: network first. A few public pages are kept for offline reading;
 *   account, admin, dev and auth pages never are (a shared phone must not show
 *   someone's account from the cache). With no network and no copy, /offline.
 * - /api/prices: network first, and every good answer is kept, so /offline can
 *   show the last known prices, clearly labelled as such.
 * - /_next/static: cache first (file names are content hashes). In development
 *   (registered as sw.js?dev=1) it's network first, so hot reload isn't fought.
 * - Nothing that changes data is ever cached (only GET, same origin).
 *
 * Registered by src/components/install/sw-register.tsx.
 */
const VERSION = "luxx-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-data`;
const DEV = new URL(self.location.href).searchParams.has("dev");

const OFFLINE_URL = "/offline";
const PRICES_URL = "/api/prices";
const SHELL_ASSETS = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg"];
/** Public pages worth reading offline. Everything else is network-only. */
const OFFLINE_PAGES = ["/", "/prices", "/tools", "/tools/hallmark", "/install", "/about"];
const NEVER = [/^\/api\/(?!prices$)/, /^\/account/, /^\/admin/, /^\/dev\//, /^\/(sign-in|sign-up|verify-email|reset-password|forgot-password)/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await Promise.all(SHELL_ASSETS.map((url) => shell.add(new Request(url, { cache: "reload" })).catch(() => {})));
      // The offline page must hydrate without a network: keep the scripts, styles and fonts it names.
      try {
        const res = await shell.match(OFFLINE_URL);
        const html = res ? await res.text() : "";
        const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
        const stat = await caches.open(STATIC);
        await Promise.all(assets.map((url) => stat.add(url).catch(() => {})));
      } catch {
        // offline page still renders its server HTML without them
      }
      try {
        const prices = await fetch(PRICES_URL, { cache: "no-store" });
        if (prices.ok) await (await caches.open(DATA)).put(PRICES_URL, prices);
      } catch {
        // first visit offline: nothing to keep yet
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("luxx-") && !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function offlineJson() {
  return new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json", "X-Luxx-Offline": "1" } });
}

async function pricesNetworkFirst(request) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(PRICES_URL, res.clone());
    return res;
  } catch {
    const hit = await cache.match(PRICES_URL);
    if (!hit) return offlineJson();
    // Mark it so the page can say these are the last known prices, not live ones.
    const headers = new Headers(hit.headers);
    headers.set("X-Luxx-Offline", "1");
    return new Response(await hit.blob(), { status: 200, headers });
  }
}

async function pageNetworkFirst(event, path) {
  const keep = OFFLINE_PAGES.includes(path) || path === OFFLINE_URL;
  try {
    const res = await fetch(event.request);
    if (keep && res.ok && res.type === "basic") {
      const copy = res.clone();
      event.waitUntil(caches.open(path === OFFLINE_URL ? SHELL : PAGES).then((c) => c.put(path, copy)));
    }
    return res;
  } catch {
    if (keep) {
      const hit = (await caches.match(path, { cacheName: PAGES })) || (await caches.match(path, { cacheName: SHELL }));
      if (hit) return hit;
    }
    return (await caches.match(OFFLINE_URL, { cacheName: SHELL })) || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function staticAsset(request) {
  const cache = await caches.open(STATIC);
  if (DEV) {
    try {
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    } catch {
      return (await cache.match(request)) || Response.error();
    }
  }
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((res) => {
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => hit || Response.error());
  if (hit) {
    event.waitUntil(refresh.catch(() => {}));
    return hit;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  if (path === PRICES_URL) {
    event.respondWith(pricesNetworkFirst(request));
    return;
  }
  if (NEVER.some((re) => re.test(path))) return;
  // React Server Component fetches during client navigation: leave them to Next.js.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(pageNetworkFirst(event, path));
    return;
  }
  if (path.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
    return;
  }
  if (path.startsWith("/icons/") || path.startsWith("/brand/") || path === "/icon.svg" || path === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(event));
  }
});
