/**
 * sw.js — service worker.
 *
 * Its only job is to make the app *launchable* with no network. The app itself
 * was already offline-capable once loaded; without this, opening it from a home
 * screen icon on a plane would show a browser error page instead.
 *
 * Two caching rules, chosen for what each kind of thing is:
 *
 *   App shell — network first, cache as fallback. The HTML carries the whole
 *   application, so a stale copy means a user running last month's sizing
 *   rules without knowing it. Freshness matters more than speed here.
 *
 *   Assets — cache first. Images and the hero film are content-addressed by the
 *   build in practice: when they change, their bytes change and the cache
 *   version below is bumped. Serving them from disk is right.
 *
 * Market data is never cached, at any age. A price is worthless the moment it
 * is stale, and a cached quote presented as live would be worse than no quote —
 * the app already handles a dead feed honestly and says so on screen.
 */

const VERSION = 'be-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

/** Cached at install so the first offline launch works even if nothing else has been visited. */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // Individually, so one missing file cannot fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Hosts whose responses must never be served from cache. */
const LIVE_DATA = /gold-api\.com|api\.binance\.com/;

const isAsset = (url) => /\.(webp|png|jpe?g|svg|mp4|webm|woff2?)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // A stale price is worse than no price. Let these fail honestly.
  if (LIVE_DATA.test(url.hostname)) return;

  // Cross-origin (fonts, chart CDNs) — leave to the browser's own HTTP cache.
  if (url.origin !== self.location.origin) return;

  /**
   * Assets: serve the cached copy instantly, then refresh it in the background.
   *
   * This used to be cache-first with no revalidation, under a VERSION constant
   * that has never changed — so an image replaced at the same filename was
   * cached permanently. Regenerating the feature screenshots, which happens
   * whenever a screen changes, would have shown returning visitors the old
   * pictures indefinitely with nothing to indicate why.
   *
   * Stale-while-revalidate keeps the instant paint and the offline behaviour,
   * and costs one background request: the new file lands in the cache now and
   * appears on the next visit rather than never.
   */
  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(request, copy)); }
            return res;
          })
          // Offline with a cached copy is a hit, not a failure. Offline without
          // one still fails, exactly as before.
          .catch((err) => { if (hit) return hit; throw err; });

        // Without this the background refresh is killed as soon as the cached
        // response is returned, and the cache never actually updates.
        if (hit) event.waitUntil(network.catch(() => {}));
        return hit || network;
      }),
    );
    return;
  }

  // App shell: fresh if we can reach the network, cached if we cannot.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(request, copy)); }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
