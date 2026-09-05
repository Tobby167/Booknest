const CACHE_NAME = "booknest-shell-v2";
const APP_SHELL = ["/", "/offline", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;

  event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
});

// --- Push Notification Handler (Native Phone Lock-Screen Alerts) ---
self.addEventListener("push", (event) => {
  let data = {
    title: "BookNest Alert",
    body: "You have a new update in BookNest.",
    url: "/dashboard/appointments",
    icon: "/pwa-icon.svg",
    badge: "/favicon.svg",
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/pwa-icon.svg",
    badge: data.badge || "/favicon.svg",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/dashboard/appointments" },
    actions: [
      { action: "open", title: "View Details" },
      { action: "close", title: "Dismiss" }
    ],
    tag: "booknest-notification",
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// --- Notification Click Handler ---
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const targetUrl = event.notification.data?.url || "/dashboard/appointments";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window tab is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if (client.url && client.navigate) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});