import { supabase } from '@/lib/supabase'
import { getServiceWorker, isServiceWorkerSupported } from '@/lib/serviceWorker'

/**
 * Web Push subscription management.
 *
 * On Android this is what makes the installed app raise a real system
 * notification — the Trusted Web Activity is built with notification
 * delegation, so it arrives under the MacroSync icon rather than Chrome's.
 *
 * The VAPID public key is hardcoded rather than an environment variable
 * because it IS public: its whole job is to be shipped to browsers so they can
 * verify the sender. Keeping it here removes a deploy-time variable that could
 * be missing in one environment and present in another. The matching PRIVATE
 * key lives only in the edge function's secrets.
 */
const VAPID_PUBLIC_KEY =
  'BETwbC7t5ce6x6m6xoSaQ55eZQjKi189hEdMD6XKla4ATmsMtW8rUYgJVsKvvCg_YO8MZHUNnWtc3nNk64FFeU4'

export type PushSupport = 'ready' | 'unsupported' | 'denied'

/**
 * Whether this browser can do push at all.
 *
 * 'denied' is separated from 'unsupported' because it needs a different
 * message: the user has to undo it in browser settings, and no amount of
 * asking again will help — the permission prompt never reappears.
 */
export function pushSupport(): PushSupport {
  if (
    !isServiceWorkerSupported() ||
    typeof window === 'undefined' ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported'
  }
  return Notification.permission === 'denied' ? 'denied' : 'ready'
}

/**
 * subscribe() wants raw bytes, not the base64url the key is written in.
 *
 * Returns the ArrayBuffer rather than the view: `applicationServerKey` is
 * typed as BufferSource, and a Uint8Array over an unknown buffer type doesn't
 * satisfy it under TypeScript 6.
 */
function applicationServerKey(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return buffer
}

/** The browser hands these back as ArrayBuffers; the server needs base64url. */
function encodeKey(subscription: PushSubscription, name: 'p256dh' | 'auth'): string {
  const raw = subscription.getKey(name)
  if (!raw) return ''
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function store(userId: string, subscription: PushSubscription): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: encodeKey(subscription, 'p256dh'),
      auth: encodeKey(subscription, 'auth'),
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString(),
    },
    // The endpoint is the device's identity. Re-subscribing on the same device
    // returns the same one, so this updates rather than piling up duplicates
    // that would each deliver a copy of every notification.
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
}

export type EnableResult = { ok: true } | { ok: false; reason: PushSupport | 'failed' }

/**
 * Ask for permission, subscribe, and record it. Safe to call when already
 * subscribed — it refreshes the stored row.
 */
export async function enablePush(userId: string): Promise<EnableResult> {
  const support = pushSupport()
  if (support !== 'ready') return { ok: false, reason: support }

  try {
    // Must be called from a user gesture, which is why this is only ever
    // reached from the toggle's onChange.
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, reason: permission === 'denied' ? 'denied' : 'failed' }
    }

    const registration = await getServiceWorker()
    if (!registration) return { ok: false, reason: 'unsupported' }

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by Chrome: every push must result in something the user
        // sees. Silent background pushes are not permitted.
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
      }))

    await store(userId, subscription)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** Unsubscribe this device and forget it. Other devices keep working. */
export async function disablePush(userId: string): Promise<void> {
  try {
    const registration = await getServiceWorker()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return

    const { endpoint } = subscription
    await subscription.unsubscribe()
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
  } catch {
    // Nothing useful to say: the preference row is what actually gates
    // sending, and the caller has already turned it off.
  }
}

/**
 * Re-record the current subscription on load.
 *
 * Browsers rotate push endpoints without telling the page — after that the
 * stored row points somewhere dead and notifications silently stop. Cheap to
 * run, and it's the difference between push working for a week and working
 * indefinitely.
 */
export async function refreshSubscription(userId: string): Promise<void> {
  if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return
  try {
    const registration = await getServiceWorker()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) await store(userId, subscription)
  } catch {
    // Best effort — the toggle re-subscribes properly if this never succeeds.
  }
}
