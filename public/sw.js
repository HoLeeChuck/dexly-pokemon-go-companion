/* global Response, URL, caches, fetch, self */

const CACHE_VERSION = 'catchgrid-__CATCHGRID_BUILD_VERSION__';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CATALOG_CACHE = `${CACHE_VERSION}-catalog`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, RUNTIME_CACHE, CATALOG_CACHE]);
const GENERATED_ASSETS = /* __CATCHGRID_GENERATED_ASSETS__ */ [];
const IS_DEVELOPMENT = GENERATED_ASSETS.length === 0;
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/legal.css',
  '/app-bootstrap.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/catchgrid-192.png',
  '/icons/catchgrid-512.png',
  ...GENERATED_ASSETS,
];

self.addEventListener('install', (event) => {
  if (IS_DEVELOPMENT) {
    // Vite serves the unexpanded build token. Never let a development worker
    // retain cache-first modules or catalog responses between local revisions.
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
      caches.open(CATALOG_CACHE).then(async (cache) => {
        try {
          const response = await fetch('/api/v1/catalog');
          if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
            await cache.put('/api/v1/catalog', response);
          }
        } catch {
          // Catalog prefetch is best-effort; the shell can still install offline safely.
        }
      }),
    ]),
  );
});

self.addEventListener('activate', (event) => {
  if (IS_DEVELOPMENT) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key.startsWith('catchgrid-')).map((key) => caches.delete(key)),
          ),
        )
        .then(() => self.clients.claim()),
    );
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('catchgrid-') && !ACTIVE_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

async function navigationResponse(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('/')) || (await caches.match('/offline.html'));
  }
}

async function catalogResponse(request) {
  const cache = await caches.open(CATALOG_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.json(
      { error: { code: 'OFFLINE', message: 'The catalog is not available offline yet.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

async function staticResponse(request) {
  const cached =
    (await caches.match(request)) || (await caches.match(new URL(request.url).pathname));
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  // Development requests must always reach Vite/Miniflare so hard refreshes
  // cannot resurrect an old catalog or remote artwork URL.
  if (IS_DEVELOPMENT) return;

  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/api/v1/catalog') {
    event.respondWith(catalogResponse(request));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  // The unlisted owner entry must always load from the network. Its API is also
  // excluded above, so neither the owner shell nor private data enter PWA caches.
  if (url.pathname.startsWith('/cody')) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (url.pathname === '/sw.js') return;
  event.respondWith(staticResponse(request));
});
