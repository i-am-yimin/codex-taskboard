const shellCache = 'taskboard-shell-v1';
const appRoot = new URL('/', self.location.origin).toString();
const isAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/');

// The first connected visit fills this cache. It intentionally caches only the
// application shell; account data continues to be handled by the scoped snapshot.
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches.open(shellCache).then(async (cache) => {
      try {
        const response = await fetch(appRoot);
        if (response.ok) await cache.put(appRoot, response);
      } catch {
        // The next connected visit can fill the shell cache.
      }
    }),
  ),
);
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-shell' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(shellCache).then(async (cache) => {
      await Promise.all(
        event.data.urls.map(async (value) => {
          try {
            const url = new URL(value, self.location.origin);
            if (!isAsset(url)) return;
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          } catch {
            // A missing optional asset must not prevent the shell from being cached.
          }
        }),
      );
    }),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !isAsset(url)) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).catch(() => caches.match(appRoot)));
    }
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(shellCache).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
