const shellCache = 'taskboard-shell-v1';
const appRoot = new URL('/', self.location.origin).toString();
const isAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/');
const isDesktopOrigin =
  self.location.hostname === 'tauri.localhost' || self.location.protocol === 'tauri:';

// Older desktop installers registered this worker on Tauri's bundled origin.
// Retire that registration when WebView2 checks for an updated worker. Keep
// localStorage, IndexedDB, and the companion's draft store untouched.
if (isDesktopOrigin) {
  self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
  self.addEventListener('activate', (event) =>
    event.waitUntil(
      (async () => {
        await self.clients.claim();
        await self.registration.unregister();
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(
          windows
            .filter((client) => client.url.startsWith(appRoot))
            .map((client) => client.navigate(client.url).catch(() => undefined)),
        );
        const names = await caches.keys();
        await Promise.all(
          names.filter((name) => name.startsWith('taskboard-shell-')).map((name) => caches.delete(name)),
        );
      })(),
    ),
  );
}
// The first connected visit fills this cache. It intentionally caches only the
// application shell; account data continues to be handled by the scoped snapshot.
if (!isDesktopOrigin) self.addEventListener('install', (event) =>
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
if (!isDesktopOrigin) self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
if (!isDesktopOrigin) self.addEventListener('message', (event) => {
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
if (!isDesktopOrigin) self.addEventListener('fetch', (event) => {
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
