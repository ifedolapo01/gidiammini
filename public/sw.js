/*
 * public/sw.js — the storefront's service worker.
 *
 * Mobile data in this market is metered and connections drop mid-browse. The
 * job here is narrow and worth stating plainly, because a service worker that
 * caches the wrong thing is far worse than none at all:
 *
 *   CACHED      the shell, the build's static assets, pages already visited,
 *               and the product images already downloaded.
 *   NEVER       anything under /api, the checkout, the account, the admin.
 *
 * That second line is the important one. Prices, stock and totals are the
 * things this codebase goes to some trouble to keep current — a cached
 * /api/products would put a stale price in front of a customer, which is the
 * exact bug the wishlist rewrite existed to fix. Money never comes from a
 * cache.
 *
 * Written by hand rather than generated. It is ninety lines, it needs to be
 * readable by whoever debugs it at 2am, and a generated one would bring a
 * runtime nobody here has read.
 */

// Bump to retire every old cache on the next activation. The build id would be
// better, but a static file in public/ cannot see it — so this is the one
// thing to change when the caching rules themselves change.
const VERSION = 'v1';

const SHELL_CACHE = `gidiammini-shell-${VERSION}`;
const PAGE_CACHE = `gidiammini-pages-${VERSION}`;
const ASSET_CACHE = `gidiammini-assets-${VERSION}`;
const IMAGE_CACHE = `gidiammini-images-${VERSION}`;

const CURRENT = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, IMAGE_CACHE]);

/** What a first visit puts away, so an install works offline immediately. */
const SHELL = ['/offline', '/icons/icon-192.png', '/manifest.webmanifest'];

/** How many of each to keep. A wishlist of a hundred product pages is not
 *  worth someone's storage quota, and browsers evict whole origins that get
 *  greedy — which would take the shell with it. */
const LIMITS = { [PAGE_CACHE]: 40, [IMAGE_CACHE]: 80 };

/**
 * Paths whose responses must always come from the network.
 *
 * /api because money and stock never come from a cache. /checkout because it
 * cannot work offline anyway — it quotes against the server before it shows
 * anybody an amount. /account and /admin because they are somebody's own data,
 * and a copy of a personal page left on a shared phone is a different kind of
 * problem entirely.
 *
 * /cart is deliberately absent: its contents come from localStorage, not from
 * the server, so the cached page is a shell that fills itself in — which is
 * exactly what somebody offline wants to look at.
 */
const NEVER_CACHE = ['/api/', '/checkout', '/account', '/admin'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, because addAll rejects the whole install if one entry
      // 404s — and an install that fails leaves the site with no worker at all.
      .then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !CURRENT.has(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

/** Oldest-first eviction. Insertion order is request order, which is close
 *  enough to least-recently-used for a shop. */
async function trim(cacheName) {
  const limit = LIMITS[cacheName];
  if (!limit) return;

  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
    await cache.delete(key);
  }
}

async function putIfOk(cacheName, request, response) {
  // Opaque responses (no-cors, from another origin) report status 0 and could
  // be an error page; caching one would pin a failure until the next version.
  if (!response || !response.ok) return;

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trim(cacheName);
}

/** Pages: network first, so a live page always wins, with the last good copy
 *  behind it and the offline page behind that. */
async function handlePage(request) {
  try {
    const fresh = await fetch(request);
    await putIfOk(PAGE_CACHE, request, fresh);
    return fresh;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const offline = await caches.match('/offline');
    return offline ?? Response.error();
  }
}

/** Build assets: cache first. Their URLs contain a content hash, so a hit is
 *  never stale — a changed file is a different URL. */
async function handleAsset(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  await putIfOk(cacheName, request, fresh);
  return fresh;
}

/** Images: serve the cached copy at once, refresh it in the background. A
 *  product photo that is a day out of date costs nothing; waiting on a bad
 *  connection to find that out costs the visit. */
async function handleImage(request) {
  const cached = await caches.match(request);

  const update = fetch(request)
    .then((fresh) => putIfOk(IMAGE_CACHE, request, fresh).then(() => fresh))
    .catch(() => null);

  return cached ?? (await update) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only plain GETs. A POST is an order, a sync or a sign-in, and replaying
  // one from a cache would be a different kind of bug entirely.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Another origin's problem — except images, which are the product photos.
  const sameOrigin = url.origin === self.location.origin;
  const isImage = request.destination === 'image';

  if (!sameOrigin && !isImage) return;
  if (sameOrigin && NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return;

  if (request.mode === 'navigate') {
    event.respondWith(handlePage(request));
    return;
  }

  if (isImage) {
    event.respondWith(handleImage(request));
    return;
  }

  if (sameOrigin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleAsset(request, ASSET_CACHE));
    return;
  }

  if (sameOrigin && (request.destination === 'style' || request.destination === 'font')) {
    event.respondWith(handleAsset(request, ASSET_CACHE));
  }
});

/** Lets the page retire a worker without waiting for every tab to close. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
