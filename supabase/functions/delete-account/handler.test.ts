import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle } from './handler.ts';
import type { Deps } from './handler.ts';

function deps(overrides: Partial<Deps> = {}) {
  const deleted: string[] = [];
  const value: Deps = {
    userFor: (token) => Promise.resolve(token === 'good' ? { id: 'u1' } : null),
    isLastAdminOfLiveGroup: () => Promise.resolve(false),
    deleteUser: (id) => {
      deleted.push(id);
      return Promise.resolve(null);
    },
    ...overrides,
  };
  return { value, deleted };
}

function post(authorization?: string) {
  return new Request('https://x.test/functions/v1/delete-account', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
}

test('deletes the caller and answers 204', async () => {
  const { value, deleted } = deps();
  const response = await handle(post('Bearer good'), value);
  assert.equal(response.status, 204);
  assert.deepEqual(deleted, ['u1']);
});

test('refuses a missing, malformed or invalid token and deletes nothing', async () => {
  for (const header of [undefined, 'good', 'Basic good', 'Bearer bad']) {
    const { value, deleted } = deps();
    const response = await handle(post(header), value);
    assert.equal(response.status, 401, String(header));
    assert.deepEqual(deleted, []);
  }
});

test('treats a failing token check as not signed in', async () => {
  const { value, deleted } = deps({ userFor: () => Promise.reject(new Error('down')) });
  const response = await handle(post('Bearer good'), value);
  assert.equal(response.status, 401);
  assert.deepEqual(deleted, []);
});

test('keeps the only admin of a group with other members', async () => {
  const { value, deleted } = deps({ isLastAdminOfLiveGroup: () => Promise.resolve(true) });
  const response = await handle(post('Bearer good'), value);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'last_admin' });
  assert.deepEqual(deleted, []);
});

test('reports a failed delete without leaking the reason', async () => {
  const { value } = deps({ deleteUser: () => Promise.resolve({ message: 'secret detail' }) });
  const response = await handle(post('Bearer good'), value);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'delete_failed' });
});

test('only POST deletes; OPTIONS answers the preflight', async () => {
  const { value, deleted } = deps();
  const get = await handle(new Request('https://x.test/', { method: 'GET' }), value);
  assert.equal(get.status, 405);
  const options = await handle(new Request('https://x.test/', { method: 'OPTIONS' }), value);
  assert.equal(options.status, 204);
  assert.ok(options.headers.get('access-control-allow-headers')?.includes('authorization'));
  assert.deepEqual(deleted, []);
});

test('deletes nothing when the admin check itself fails', async () => {
  const { value, deleted } = deps({
    isLastAdminOfLiveGroup: () => Promise.reject(new Error('db')),
  });
  const response = await handle(post('Bearer good'), value);
  assert.equal(response.status, 503);
  assert.deepEqual(deleted, []);
});
