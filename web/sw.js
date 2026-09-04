// Cachar appskalet. API-svar cachas som "senast känt" så appen visar något offline.
const SHELL = "studiett-shell-v4";
const DATA = "studiett-data-v4";
const SHELL_FILES = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.webmanifest", "/icons/icon.svg", "/fonts/fraunces-latin.woff2"];

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
    if (url.pathname === "/api/ladok-import") return; // aldrig cachat, aldrig offline
    // Svaret sparas under vägen oavsett metod (POST bär Ladok-data), så "senast känt" finns offline.
    const key = new Request(url.pathname);
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) caches.open(DATA).then(c => c.put(key, res.clone()));
      return res;
    }).catch(() => caches.match(key)));
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(hit => hit ?? fetch(e.request)));
});
