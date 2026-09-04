// Cachar appskalet. API-svar cachas som "senast känt" så appen visar något offline.
const SHELL = "studiett-shell-v1";
const DATA = "studiett-data-v1";
const SHELL_FILES = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, DATA].includes(k)).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(DATA).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit ?? fetch(e.request)));
});
