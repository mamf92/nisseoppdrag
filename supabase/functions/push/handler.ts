// The push function's logic, with its dependencies passed in so that it can be tested without Deno
// or a database. index.ts wires it to Supabase.
//
//   GET  /push/key       the VAPID public key (the browser needs it to subscribe)
//   POST /push/test      sends «hello» to the signed-in caller's own devices
//   POST /push/dispatch  sends the Monday/Thursday messages that are due; only pg_cron may call it
import { buildPushRequest } from './webpush.ts';
import type { VapidKeys } from './webpush.ts';
import { compose } from './messages.ts';
import type { Target } from './messages.ts';

export interface Deps {
  /** VAPID keys and the cron secret, from Vault. */
  config: () => Promise<{ vapid: VapidKeys; cronSecret: string | null }>;
  userFor: (token: string) => Promise<{ id: string } | null>;
  claimDue: () => Promise<Target[]>;
  claimTest: (userId: string) => Promise<Target[]>;
  forget: (endpoints: string[]) => Promise<void>;
  /** Delivers one request to a push service (fetch in production). */
  send: (request: Request) => Promise<Response>;
  subject: string;
}

const HEADERS = {
  // Authentication is a bearer token or the cron secret, never a cookie.
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'cache-control': 'no-store',
  'content-type': 'application/json',
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

/** Compares two strings in time that does not depend on where they differ. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface Delivery {
  sent: number;
  gone: number;
  failed: number;
}

/** Sends to every target, at most 20 at a time, and forgets the endpoints that are gone. */
export async function deliver(targets: Target[], deps: Deps, vapid: VapidKeys): Promise<Delivery> {
  const result: Delivery = { sent: 0, gone: 0, failed: 0 };
  const gone: string[] = [];
  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20);
    const outcomes = await Promise.allSettled(
      batch.map(async (target) => {
        const { message, options } = compose(target);
        const request = await buildPushRequest(target, message, vapid, deps.subject, options);
        return deps.send(request);
      }),
    );
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled' && outcome.value.ok) result.sent++;
      else if (
        outcome.status === 'fulfilled' &&
        (outcome.value.status === 404 || outcome.value.status === 410)
      ) {
        result.gone++;
        gone.push(batch[index]!.endpoint);
      } else result.failed++;
    });
  }
  if (gone.length > 0) await deps.forget(gone);
  return result;
}

function route(request: Request): string {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return path.slice(path.lastIndexOf('/') + 1);
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  const name = route(request);

  if (name === 'key') {
    if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    const { vapid } = await deps.config();
    // The public key only changes if Vault is reset, so browsers may keep it for an hour.
    return json(200, { publicKey: vapid.publicKey }, { 'cache-control': 'public, max-age=3600' });
  }

  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  if (name === 'test') {
    const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '');
    const user = match?.[1] ? await deps.userFor(match[1]).catch(() => null) : null;
    if (!user) return json(401, { error: 'not_signed_in' });
    const { vapid } = await deps.config();
    const targets = await deps.claimTest(user.id);
    if (targets.length === 0) return json(429, { error: 'no_device_or_too_soon' });
    return json(200, await deliver(targets, deps, vapid));
  }

  if (name === 'dispatch') {
    const { vapid, cronSecret } = await deps.config();
    const given = request.headers.get('x-nisse-cron') ?? '';
    if (!cronSecret || !sameSecret(given, cronSecret)) return json(401, { error: 'not_cron' });
    const targets = await deps.claimDue();
    return json(200, await deliver(targets, deps, vapid));
  }

  return json(404, { error: 'not_found' });
}
