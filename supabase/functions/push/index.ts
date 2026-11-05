import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handle } from './handler.ts';
import type { Deps } from './handler.ts';
import type { Target } from './messages.ts';
import { generateVapidKeys } from './webpush.ts';
import type { VapidKeys } from './webpush.ts';

// Web Push sender. The service-role key exists only here, as a function secret Supabase injects.
// The VAPID key pair is made here on first use and kept in Vault (public.push_server_config); the
// private half never reaches a browser, the repository or a log.
const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let cached: { vapid: VapidKeys; cronSecret: string | null } | null = null;

async function config() {
  if (cached) return cached;
  let { data, error } = await admin.rpc('push_server_config');
  if (error) throw new Error(error.message);
  let stored = data as { vapid: VapidKeys | null; cron_secret: string | null };
  if (!stored.vapid) {
    // First run: offer a fresh pair. If another instance got there first, its pair comes back.
    ({ data, error } = await admin.rpc('push_server_config', {
      p_vapid: (await generateVapidKeys()) as unknown as Record<string, unknown>,
    }));
    if (error) throw new Error(error.message);
    stored = data as typeof stored;
  }
  if (!stored.vapid) throw new Error('no_vapid_keys');
  cached = { vapid: stored.vapid, cronSecret: stored.cron_secret };
  return cached;
}

const deps: Deps = {
  config,
  async userFor(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  },
  async claimDue() {
    const { data, error } = await admin.rpc('push_claim_due');
    if (error) throw new Error(error.message);
    return (data ?? []) as Target[];
  },
  async claimTest(userId) {
    const { data, error } = await admin.rpc('push_claim_test', { p_user: userId });
    if (error) throw new Error(error.message);
    return (data ?? []) as Target[];
  },
  async forget(endpoints) {
    const { error } = await admin.rpc('push_forget', { p_endpoints: endpoints });
    if (error) throw new Error(error.message);
  },
  send: (request) => fetch(request, { signal: AbortSignal.timeout(10_000) }),
  subject: 'https://nisseoppdrag.no',
};

Deno.serve(async (request) => {
  try {
    return await handle(request, deps);
  } catch (error) {
    console.error('push failed', error instanceof Error ? error.message : 'unknown');
    return new Response(JSON.stringify({ error: 'push_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
});
