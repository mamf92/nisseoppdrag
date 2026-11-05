// Nisseoppdrag service worker (experimental PWA).
//
// - App shell: the build replaces the two constants below with its version and the list of files
//   it produced (see vite-pwa.ts), so the app opens offline and starts instantly.
// - Paintings, fonts and icons: cached as they are used, refreshed in the background.
// - Supabase and every other origin: never touched; game data always comes from the server.
// - Push: shows the Declarative Web Push JSON our push function sends, and sets the app badge.
//
// A new version waits until the page asks it to take over (the «Ny versjon» toast).

const BUILD = 'dev';
const PRECACHE = [];

const SHELL = `nisse-shell-${BUILD}`;
const MEDIA = 'nisse-media-v1';
const MEDIA_PATHS = ['/art/', '/fonts/', '/icons/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('nisse-shell-') && key !== SHELL)
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

async function fromNetworkOrShell(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const shell = await caches.match('/index.html');
    return shell ?? Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then(async (response) => {
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fromNetworkOrShell(event));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (MEDIA_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// ---------- push ----------

function readPush(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { notification: { title: 'Nisseoppdrag', body: event.data.text() } };
  }
}

async function setBadge(value) {
  const count = Number.parseInt(String(value), 10);
  if (!('setAppBadge' in self.navigator) || Number.isNaN(count)) return;
  try {
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // badging is a nicety; never fail the push over it
  }
}

self.addEventListener('push', (event) => {
  const message = readPush(event);
  const note = message?.notification;
  if (!note?.title) return;
  const url = new URL(note.navigate ?? '/', self.location.origin);
  // only ever open our own site from a notification
  const target = url.origin === self.location.origin ? url.href : self.location.origin + '/';
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(note.title, {
        body: note.body,
        lang: note.lang,
        dir: note.dir ?? 'auto',
        tag: note.tag,
        renotify: Boolean(note.tag),
        silent: Boolean(note.silent),
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        data: { url: target },
      }),
      message.app_badge === undefined ? undefined : setBadge(message.app_badge),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? self.location.origin + '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
