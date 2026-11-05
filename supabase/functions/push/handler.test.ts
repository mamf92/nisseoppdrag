import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle, sameSecret } from './handler.ts';
import type { Deps } from './handler.ts';
import { compose } from './messages.ts';
import type { Target } from './messages.ts';
import { b64urlEncode, generateVapidKeys } from './webpush.ts';

async function target(overrides: Partial<Target> = {}): Promise<Target> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${Math.random()}`,
    p256dh: b64urlEncode(raw),
    auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
    origin: 'https://nisseoppdrag.no',
    lang: 'nb',
    kind: 'new_week',
    story: 'laaven',
    open_count: 5,
    ...overrides,
  };
}

async function deps(overrides: Partial<Deps> = {}) {
  const vapid = await generateVapidKeys();
  const sent: Request[] = [];
  const forgotten: string[][] = [];
  const value: Deps = {
    config: () => Promise.resolve({ vapid, cronSecret: 'cron-secret' }),
    userFor: (token) => Promise.resolve(token === 'good' ? { id: 'u1' } : null),
    claimDue: async () => [
      await target(),
      await target({ endpoint: 'https://fcm.googleapis.com/gone' }),
    ],
    claimTest: async (id) => (id === 'u1' ? [await target({ kind: 'test' })] : []),
    forget: (endpoints) => {
      forgotten.push(endpoints);
      return Promise.resolve();
    },
    send: (request) => {
      sent.push(request);
      return Promise.resolve(
        new Response(null, { status: request.url.endsWith('/gone') ? 410 : 201 }),
      );
    },
    subject: 'https://nisseoppdrag.no',
    ...overrides,
  };
  return { value, vapid, sent, forgotten };
}

const at = (path: string, init?: RequestInit) =>
  new Request(`https://x.supabase.co/functions/v1/push/${path}`, init);

test('serves the public VAPID key, never the private one', async () => {
  const { value, vapid } = await deps();
  const response = await handle(at('key'), value);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { publicKey: vapid.publicKey });
  assert.ok(!body.includes(String(vapid.privateJwk.d)));
});

test('the dispatch needs the cron secret', async () => {
  for (const secret of [undefined, '', 'cron-secreT', 'cron-secret-and-more']) {
    const { value, sent } = await deps();
    const headers: Record<string, string> = secret === undefined ? {} : { 'x-nisse-cron': secret };
    const response = await handle(at('dispatch', { method: 'POST', headers }), value);
    assert.equal(response.status, 401, String(secret));
    assert.equal(sent.length, 0);
  }
});

test('the dispatch is refused when no cron secret is configured', async () => {
  const { value, vapid } = await deps();
  value.config = () => Promise.resolve({ vapid, cronSecret: null });
  const response = await handle(
    at('dispatch', { method: 'POST', headers: { 'x-nisse-cron': '' } }),
    value,
  );
  assert.equal(response.status, 401);
});

test('the dispatch sends what is due and forgets endpoints that are gone', async () => {
  const { value, sent, forgotten } = await deps();
  const response = await handle(
    at('dispatch', { method: 'POST', headers: { 'x-nisse-cron': 'cron-secret' } }),
    value,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 1, gone: 1, failed: 0 });
  assert.equal(sent.length, 2);
  assert.deepEqual(forgotten, [['https://fcm.googleapis.com/gone']]);
  assert.equal(sent[0]!.headers.get('content-encoding'), 'aes128gcm');
});

test('a failing push service is counted, not fatal', async () => {
  const { value } = await deps({ send: () => Promise.reject(new Error('timeout')) });
  const response = await handle(
    at('dispatch', { method: 'POST', headers: { 'x-nisse-cron': 'cron-secret' } }),
    value,
  );
  assert.deepEqual(await response.json(), { sent: 0, gone: 0, failed: 2 });
});

test('a test goes only to the signed-in caller', async () => {
  const { value, sent } = await deps();
  const anonymous = await handle(at('test', { method: 'POST' }), value);
  assert.equal(anonymous.status, 401);
  const bad = await handle(
    at('test', { method: 'POST', headers: { authorization: 'Bearer bad' } }),
    value,
  );
  assert.equal(bad.status, 401);
  assert.equal(sent.length, 0);
  const good = await handle(
    at('test', { method: 'POST', headers: { authorization: 'Bearer good' } }),
    value,
  );
  assert.equal(good.status, 200);
  assert.equal(sent.length, 1);
});

test('a test with no device, or too soon, says so', async () => {
  const { value } = await deps({ claimTest: () => Promise.resolve([]) });
  const response = await handle(
    at('test', { method: 'POST', headers: { authorization: 'Bearer good' } }),
    value,
  );
  assert.equal(response.status, 429);
});

test('unknown routes and methods are refused; OPTIONS answers the preflight', async () => {
  const { value } = await deps();
  assert.equal((await handle(at('nope', { method: 'POST' }), value)).status, 404);
  assert.equal((await handle(at('dispatch'), value)).status, 405);
  assert.equal((await handle(at('key', { method: 'POST' }), value)).status, 405);
  assert.equal((await handle(at('test', { method: 'OPTIONS' }), value)).status, 204);
});

test('messages follow story and language, and use the declarative format', async () => {
  const laaven = compose(await target({ story: 'laaven', lang: 'nb', open_count: 3 }));
  assert.equal(laaven.message.web_push, 8030);
  assert.equal(laaven.message.notification.title, 'Nye oppdrag på låven');
  assert.match(laaven.message.notification.body, /3 oppdrag/);
  assert.equal(laaven.message.notification.navigate, 'https://nisseoppdrag.no/');
  assert.equal(laaven.message.app_badge, '3');
  assert.equal(laaven.options.topic, 'new-week');

  const gaarden = compose(await target({ story: 'gaarden', lang: 'en', kind: 'reminder' }));
  assert.equal(gaarden.message.notification.title, 'The barn is not full yet');
  assert.equal(gaarden.message.notification.lang, 'en');

  const odd = compose(await target({ story: 'x', lang: 'de', kind: '?', open_count: 1e6 }));
  assert.equal(odd.message.notification.title, 'Nissefar sier hei');
  assert.equal(odd.message.app_badge, '99');
});

test('secret comparison', () => {
  assert.ok(sameSecret('abc', 'abc'));
  assert.ok(!sameSecret('abc', 'abd'));
  assert.ok(!sameSecret('abc', 'abcd'));
});
