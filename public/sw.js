/**
 * Service Worker — SF Fantasy & Sci-Fi Book Club
 *
 * Strategy:
 *   - Static assets (CSS, JS, fonts, placeholder images) → Cache-first
 *   - Cover images → Cache-first with network fallback
 *   - HTML pages → Network-first with cache fallback (stale-while-revalidate)
 *   - API requests → Network-only (never cached)
 */

'use strict';

const CACHE_VERSION = 'sfbc-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PAGE_CACHE = CACHE_VERSION + '-pages';
const IMAGE_CACHE = CACHE_VERSION + '-images';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/img/placeholder-cover.svg',
  '/manifest.json',
];

// ───────────────────────────────────────────
// Install — pre-cache static shell
// ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately, don't wait for old tabs to close
  self.skipWaiting();
});

// ───────────────────────────────────────────
// Activate — clean old caches
// ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('sfbc-') && key !== STATIC_CACHE && key !== PAGE_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open tabs
  self.clients.claim();
});

// ───────────────────────────────────────────
// Fetch — routing strategies
// ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (API POSTs, PUTs, etc.)
  if (event.request.method !== 'GET') return;

  // Skip API requests — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Skip admin pages — always fresh
  if (url.pathname.startsWith('/admin')) return;

  // Static assets → cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Cover images → cache-first
  if (url.pathname.startsWith('/img/covers/')) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // Icon images → cache-first
  if (url.pathname.startsWith('/img/icons/')) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // HTML pages → network-first with cache fallback
  if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(networkFirst(event.request, PAGE_CACHE));
    return;
  }
});

// ───────────────────────────────────────────
// Strategies
// ───────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(css|js|svg|woff2?|ttf|eot|json)$/.test(pathname)
    && !pathname.endsWith('manifest.json'); // manifest can change
}

/**
 * Cache-first: try cache, fall back to network, cache the response.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // If both cache and network fail, return a basic offline response
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Network-first: try network, cache successful responses, fall back to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return a basic offline page
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#333}div{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#666}</style></head><body><div><h1>You\'re offline</h1><p>Check your connection and try again.</p></div></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
