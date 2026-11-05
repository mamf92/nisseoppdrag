// Turning Web Push on and off for this browser. The subscription goes to the database through
// the push_* RPCs (row level security, server-side validation); the VAPID public key comes from
// the push Edge Function, which made it and keeps the private half.
import { supabase } from '../lib/supabase';
import type { Db } from '../lib/supabase';
import type { Language } from '../i18n/messages';
import { detectPlatform } from './platform';

export type PushStatus =
  /** This browser cannot do Web Push (old iOS, some in-app browsers). */
  | 'unsupported'
  /** iPhone/iPad in a browser tab: Web Push only works from the installed app. */
  | 'needs-install'
  /** The visitor said no; only the browser's settings can undo that. */
  | 'denied'
  | 'off'
  | 'on';

export interface PushPrefs {
  newWeek: boolean;
  reminder: boolean;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushStatus(): Promise<PushStatus> {
  const { platform, iosTooOldForPush } = detectPlatform();
  if (iosTooOldForPush) return 'unsupported';
  if (platform === 'ios-safari' || platform === 'ios-other' || platform === 'ios-inapp')
    return 'needs-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function publicKey(client: Db): Promise<string> {
  const result: { data: unknown; error: unknown } = await client.functions.invoke('push/key', {
    method: 'GET',
  });
  const key = (result.data as { publicKey?: unknown } | null)?.publicKey;
  if (result.error || typeof key !== 'string') throw new Error('push_key_unavailable');
  return key;
}

async function save(
  client: Db,
  subscription: PushSubscription,
  lang: Language,
  prefs: Partial<PushPrefs>,
): Promise<void> {
  const json = subscription.toJSON();
  const { error } = await client.rpc('push_subscribe', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.['p256dh'] ?? '',
    p_auth: json.keys?.['auth'] ?? '',
    p_origin: window.location.origin,
    p_lang: lang,
    ...(prefs.newWeek === undefined ? {} : { p_new_week: prefs.newWeek }),
    ...(prefs.reminder === undefined ? {} : { p_reminder: prefs.reminder }),
  });
  if (error) throw new Error(error.message);
}

/**
 * Asks for permission and subscribes. Must run straight from a tap: Safari only shows the
 * permission prompt for a user gesture, so nothing is awaited before it.
 */
export async function enablePush(client: Db, lang: Language): Promise<PushStatus> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  // `ready` would wait forever where no worker is registered (e.g. `pnpm dev`), so ask instead.
  const reg = await registration();
  if (!reg) throw new Error('no_service_worker');
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(await publicKey(client)),
    }));
  await save(client, subscription, lang, { newWeek: true, reminder: true });
  return 'on';
}

export async function disablePush(client: Db): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await client.rpc('push_unsubscribe', { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/** Re-saves this browser's subscription (keys can rotate) and its language; switches stay. */
export async function syncPush(client: Db, lang: Language): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const subscription = await currentSubscription();
  if (subscription) await save(client, subscription, lang, {});
}

export async function readPrefs(client: Db): Promise<PushPrefs | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const { data } = await client
    .from('push_subscriptions')
    .select('new_week, reminder')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle();
  return data ? { newWeek: data.new_week, reminder: data.reminder } : null;
}

export async function updatePrefs(client: Db, lang: Language, prefs: PushPrefs): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const { error } = await client.rpc('push_update', {
    p_endpoint: subscription.endpoint,
    p_lang: lang,
    p_new_week: prefs.newWeek,
    p_reminder: prefs.reminder,
  });
  if (error) throw new Error(error.message);
}

/** Asks the push function to greet this account's devices. Resolves to false when held back. */
export async function sendTestPush(client: Db): Promise<boolean> {
  const result: { error: unknown } = await client.functions.invoke('push/test', { method: 'POST' });
  return !result.error;
}

/** Signing out: this browser stops receiving the account's notifications. */
export async function forgetThisDevice(): Promise<void> {
  if (supabase && pushSupported()) await disablePush(supabase);
}
