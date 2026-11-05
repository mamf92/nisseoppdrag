import assert from 'node:assert/strict';
import { createECDH, createPublicKey, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  b64urlDecode,
  b64urlEncode,
  buildPushRequest,
  encrypt,
  generateVapidKeys,
  vapidHeader,
} from './webpush.ts';

// http_ece is the reference implementation behind the `web-push` package. It is used here only as
// an independent receiver: if it can decrypt what we send, browsers can too.
const require = createRequire(import.meta.url);
const ece = require('http_ece') as {
  decrypt: (
    buffer: Buffer,
    params: { version: string; privateKey: unknown; authSecret: string },
  ) => Buffer;
};

function browser() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    ecdh,
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: b64urlEncode(new Uint8Array(ecdh.getPublicKey())),
      auth: b64urlEncode(auth),
    },
  };
}

test('base64url round-trips without padding', () => {
  for (const length of [0, 1, 2, 3, 16, 65]) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    const text = b64urlEncode(bytes);
    assert.doesNotMatch(text, /[+/=]/);
    assert.deepEqual(b64urlDecode(text), bytes);
  }
});

test('the reference decrypter reads our aes128gcm messages', async () => {
  const { ecdh, subscription } = browser();
  const message = JSON.stringify({ web_push: 8030, notification: { title: 'Grøt!' } });
  const body = await encrypt(new TextEncoder().encode(message), subscription);
  const plain = ece.decrypt(Buffer.from(body), {
    version: 'aes128gcm',
    privateKey: ecdh,
    authSecret: subscription.auth,
  });
  assert.equal(plain.toString('utf8'), message);
});

test('every message gets a fresh salt and server key', async () => {
  const { subscription } = browser();
  const one = await encrypt(new Uint8Array([1]), subscription);
  const two = await encrypt(new Uint8Array([1]), subscription);
  assert.notDeepEqual(one.slice(0, 16), two.slice(0, 16));
  assert.notDeepEqual(one.slice(21, 86), two.slice(21, 86));
  assert.equal(one[20], 65, 'the header carries the 65-byte server key');
});

test('refuses broken subscription keys and oversized payloads', async () => {
  const { subscription } = browser();
  await assert.rejects(encrypt(new Uint8Array(1), { ...subscription, p256dh: 'AAAA' }), /p256dh/);
  await assert.rejects(encrypt(new Uint8Array(1), { ...subscription, auth: 'AAAA' }), /auth/);
  await assert.rejects(encrypt(new Uint8Array(4000), subscription), /too_large/);
});

test('the VAPID header is a valid ES256 JWT for the push service origin', async () => {
  const keys = await generateVapidKeys();
  const now = Date.UTC(2026, 11, 1);
  const header = await vapidHeader(
    'https://web.push.apple.com/QA9xyz',
    keys,
    'https://nisseoppdrag.no',
    now,
  );
  const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
  assert.ok(match, header);
  const [, head, claims, signature, k] = match;
  assert.equal(k, keys.publicKey);
  assert.deepEqual(JSON.parse(Buffer.from(b64urlDecode(head!)).toString()), {
    typ: 'JWT',
    alg: 'ES256',
  });
  assert.deepEqual(JSON.parse(Buffer.from(b64urlDecode(claims!)).toString()), {
    aud: 'https://web.push.apple.com',
    exp: now / 1000 + 12 * 3600,
    sub: 'https://nisseoppdrag.no',
  });
  const publicKey = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: keys.privateJwk.x, y: keys.privateJwk.y },
    format: 'jwk',
  });
  const ok = verify(
    'sha256',
    Buffer.from(`${head}.${claims}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(b64urlDecode(signature!)),
  );
  assert.ok(ok, 'signature verifies with the public key');
});

test('the push request carries the headers push services require', async () => {
  const { subscription } = browser();
  const keys = await generateVapidKeys();
  const request = await buildPushRequest(subscription, { hi: 1 }, keys, 'https://x.test', {
    topic: 'new-week',
    urgency: 'high',
    ttlSeconds: 60,
  });
  assert.equal(request.method, 'POST');
  assert.equal(request.url, subscription.endpoint);
  assert.equal(request.headers.get('content-encoding'), 'aes128gcm');
  assert.equal(request.headers.get('ttl'), '60');
  assert.equal(request.headers.get('urgency'), 'high');
  assert.equal(request.headers.get('topic'), 'new-week');
  assert.match(request.headers.get('authorization') ?? '', /^vapid t=/);
});
