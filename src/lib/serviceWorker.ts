/**
 * Service worker registration.
 *
 * The worker itself (public/sw.js) does two jobs: an offline fallback page, and
 * receiving push notifications — a push event can only be delivered to a
 * service worker, so there is no way to have push without one.
 *
 * Registration is best-effort. Every failure mode here (no support, an insecure
 * origin, storage blocked, a corporate policy) leaves the app working exactly
 * as it does today, so none of them are worth surfacing to the user.
 */

const SW_URL = '/sw.js'

let registration: ServiceWorkerRegistration | null = null
let pending: Promise<ServiceWorkerRegistration | null> | null = null

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return Promise.resolve(null)

  // The dev server serves no sw.js, and registering one there would leave a
  // worker installed on localhost that outlives the session and intercepts
  // later work.
  if (import.meta.env.DEV) return Promise.resolve(null)

  pending ??= navigator.serviceWorker
    .register(SW_URL, { scope: '/' })
    .then((reg) => {
      registration = reg
      return reg
    })
    .catch(() => null)

  return pending
}

/**
 * The active registration, registering first if that hasn't happened yet.
 * Push subscription needs this, and it can be called before the initial
 * registration has settled.
 */
export async function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration
  return registerServiceWorker()
}
