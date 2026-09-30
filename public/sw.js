// Service worker for the whole site — two unrelated jobs:
//   1. Web push for the Admin panel (below) — only ever subscribed-to from
//      /admin, so a logged-out visitor never triggers a subscribe prompt.
//   2. Cache-first serving of Next.js's own build output (this file's
//      fetch handler) — installing the site (or just opening the public
//      site, see RegisterServiceWorker.tsx) used to re-download every JS/CSS
//      chunk from the network on every single visit, since nothing ever
//      cached them. iOS in particular re-evicts a home-screen web app's
//      in-memory state far more aggressively than a native app, so every
//      reopen paid that full cost again — this is what made the app feel
//      slow to open on iPhone specifically.

// Bumping this invalidates every previously cached response on the next
// activate — only ever needed if the caching strategy itself changes, never
// for an ordinary deploy (see the fetch handler below for why).
const STATIC_CACHE = "ceejay-static-v1";

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every open tab of the old
  // service worker to close first — this cache only ever adds speed, never
  // changes behavior, so there's nothing risky about switching right away.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Cache-first, but ONLY for /_next/static/* — every JS/CSS/font chunk under
// there is content-hashed per build (the filename itself changes whenever
// the code does), so a cached copy can never go stale: a new deploy is
// served under entirely new URLs, and the old cached ones simply stop being
// requested (and get swept on the next activate above). Nothing else is
// touched — every page navigation, every Server Action, every /admin or
// /technician request always hits the network fresh, so live business data
// (check-ins, requests, sales, everything) is never at risk of being served
// from a cache.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Ceejay Admin", body: "You have a new notification.", url: "/admin/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to the defaults above.
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url },
      });
      // Home-screen icon badge count — only iOS/Safari's newer Badging API
      // exposes this from a service worker; older/unsupported browsers just
      // skip it silently.
      if (typeof data.badgeCount === "number" && "setAppBadge" in self.registration) {
        try {
          if (data.badgeCount > 0) await self.registration.setAppBadge(data.badgeCount);
          else await self.registration.clearAppBadge();
        } catch {
          // Badging unsupported/blocked — the notification itself already went through.
        }
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin/notifications";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsList.find((c) => new URL(c.url).pathname === url);
      if (existing) {
        await existing.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })()
  );
});
