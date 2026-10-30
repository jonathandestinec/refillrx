const CACHE_NAME = "refillrx-shell-v3";
const IS_DEVELOPMENT =
  new URL(self.location.href).searchParams.has("dev") ||
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";
// Pages and assets that make sense with no connection at all.
const APP_SHELL = ["/", "/offline", "/manifest.webmanifest", "/icons/refillrx.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ).then(() => self.clients.claim()),
    ),
  );
});

// Static assets (Next build output, icons, doodles) are served cache-first:
// they are content-hashed by Next, so a hashed miss recomputes safely.
// Pages use network-first with a cache fallback so a visited page stays readable
// offline; anything else goes to the offline fallback.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache sensitive or live data.
  if (url.pathname.startsWith("/api/") || url.pathname.includes("supabase")) return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/doodles/") ||
    /\.(svg|png|jpg|jpeg|webp|woff2|css|js)$/.test(url.pathname);

  // Account areas can contain order, payment, and chat data: the plan
  // explicitly keeps those out of offline storage.
  const isAccountArea = url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/pharmacy");

  if (isStaticAsset) {
    if (IS_DEVELOPMENT) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (isAccountArea) return response;
      const clone = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    }).catch(() =>
      caches.match(request).then((cached) => cached || caches.match("/offline")),
    ),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "RefillRx update";
  const options = {
    body: data.body || "There is an update about your refill.",
    icon: "/icons/refillrx.svg",
    badge: "/icons/refillrx.svg",
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(target));
});
