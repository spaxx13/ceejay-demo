// Web push service worker for the Admin panel. Scoped to the whole site
// (registered from "/") but only ever subscribed-to from /admin — a
// logged-out visitor never triggers a subscribe prompt.

self.addEventListener("push", (event) => {
  let data = { title: "Ceejay Admin", body: "You have a new notification.", url: "/admin/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to the defaults above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    })
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
