// Bump VERSION on every sw.js change — activate deletes all caches from
// older versions. Pages/assets are (re)cached at runtime as they're visited,
// so a stale cache never outlives a deploy by more than one visit.
const VERSION = 'v2'
const PAGE_CACHE = `ow-pages-${VERSION}`
const ASSET_CACHE = `ow-assets-${VERSION}`
const OFFLINE_URL = '/offline'
const MAX_PAGES = 40 // dashboard + lists + ~10-12 projects/invoices; oldest evicted

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGE_CACHE).then((c) => c.add(OFFLINE_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== PAGE_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > max) await cache.delete(keys[0]) // oldest first (insertion order)
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Same-origin only: NEVER intercept Supabase (auth tokens, signed URLs) or
  // any other cross-origin request.
  if (url.origin !== self.location.origin) return

  // Never cache API routes (keep-alive, PDF/email endpoints).
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network-first; on failure serve the last cached copy of
  // that page, else the offline splash.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy)).then(() => trimCache(PAGE_CACHE, MAX_PAGES))
          }
          return res
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(OFFLINE_URL)))
    )
    return
  }

  // Hashed build assets are immutable — cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
      )
    )
    return
  }

  // Other same-origin static files (icons, manifest, pdf worker):
  // stale-while-revalidate.
  if (/\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf|css|js|mjs|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((hit) => {
        const refresh = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
          .catch(() => hit)
        return hit ?? refresh
      })
    )
  }
})
