/* Reckoner service worker.
   The whole app is four small files, so it precaches everything and serves
   cache-first. Bump CACHE when you change any file — that is what makes an
   installed copy pick up the new version.                                   */

var CACHE = "reckoner-v1";

var ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;

      return fetch(e.request)
        .then(function (res) {
          // stash same-origin responses so a first visit while online
          // leaves nothing missing later
          if (res && res.ok && res.type === "basic") {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        })
        .catch(function () {
          // offline and not cached: navigations still get the app shell
          if (e.request.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
