// Parchi Orders service worker (D108): keeps the salesman app usable with no
// signal. It caches ONLY the /salesman page shell and the app's static
// scripts, styles and icons. Retailer and desk pages, data requests and server
// actions are never cached (prices, credit and orders stay off shared caches).
const CACHE = "parchi-salesman-v1";
const SHELL = "/salesman";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// The app sends the URLs it loaded, so the scripts used before this worker took control are cached too.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => {
    const url = new URL(u, self.location.origin);
    return url.origin === self.location.origin && (url.pathname === SHELL || isStatic(url));
  });
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)))));
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon") || url.pathname.startsWith("/apple-icon") || url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    // Hashed file names never change: cache first.
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
        return res;
      })),
    );
    return;
  }

  if (request.mode === "navigate" && url.pathname === SHELL) {
    // Network first (fresh when online); the saved shell when there is no signal.
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok && res.type === "basic" && !res.redirected) caches.open(CACHE).then((c) => c.put(SHELL, res.clone()));
        return res;
      }).catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    );
  }
  // Everything else goes to the network untouched.
});
