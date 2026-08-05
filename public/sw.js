/*
 * MacroSync service worker.
 *
 * DELIBERATELY NOT A PRECACHING WORKER. The Android app is a Trusted Web
 * Activity pointed at this site, so a deploy is meant to reach users the moment
 * Vercel finishes — no rebuild, no store review. A worker that precaches the
 * app shell is the standard way an installed web app ends up serving last
 * week's build, and it would quietly break exactly that guarantee.
 *
 * So: every request goes to the network. The cache holds two things that are
 * useless to keep fresh and useful to have offline — the offline page and the
 * icons. Nothing else is ever stored, and no HTML is stored at all.
 *
 * It also carries the push handlers, since a push event can only be received by
 * a service worker.
 */

const CACHE = 'macrosync-shell-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Take over straight away rather than waiting for every tab to close.
      // Safe here precisely because nothing version-specific is cached.
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only navigations are handled. Everything else — the hashed JS/CSS, Supabase
  // calls, images — falls through to the browser untouched, which is what keeps
  // a stale asset from ever being served.
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return (await cache.match(OFFLINE_URL)) ?? Response.error()
    }),
  )
})

/* ── Push ──────────────────────────────────────────────────────────────────
 * Sent by the send-notification edge function, which builds the same wording
 * it puts in the email. The payload is JSON; anything malformed still shows
 * something rather than nothing, because a silent no-op looks like a bug in
 * the sender.
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'MacroSync', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'MacroSync'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Collapses repeats of the same kind rather than stacking six identical
      // "someone commented" notifications.
      tag: payload.tag || 'macrosync',
      renotify: Boolean(payload.tag),
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  // Focus an existing window if one is open — opening a second copy of the app
  // on top of the one already running is jarring.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
