import { describe, expect, it } from 'vitest';
import { checkSupabaseEnv } from './supabaseEnv';

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';
const KEY_OK = 'sb_publishable_AbC123_xyz';

function jwt(role: string): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ role })}.sig`;
}

describe('checkSupabaseEnv', () => {
  it('accepts a hosted project with a publishable key', () => {
    expect(checkSupabaseEnv({ url: URL_OK, key: KEY_OK })).toEqual([]);
  });

  it('accepts the local stack with a legacy anon JWT', () => {
    expect(checkSupabaseEnv({ url: 'http://127.0.0.1:54321', key: jwt('anon') })).toEqual([]);
  });

  it('reports missing values', () => {
    expect(checkSupabaseEnv({ url: undefined, key: undefined })).toHaveLength(2);
    expect(checkSupabaseEnv({ url: '', key: KEY_OK })).toHaveLength(1);
  });

  it('catches the URL and the key being swapped', () => {
    const problems = checkSupabaseEnv({ url: KEY_OK, key: URL_OK });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/swapped/);
    expect(problems[1]).toMatch(/swapped/);
  });

  it('rejects secret and service_role keys', () => {
    expect(checkSupabaseEnv({ url: URL_OK, key: 'sb_secret_abc' })[0]).toMatch(/SECRET/);
    expect(checkSupabaseEnv({ url: URL_OK, key: jwt('service_role') })[0]).toMatch(/service_role/);
  });

  it('rejects http, other hosts, paths and quotes', () => {
    expect(checkSupabaseEnv({ url: 'http://abc.supabase.co', key: KEY_OK })[0]).toMatch(/https/);
    expect(checkSupabaseEnv({ url: 'https://example.com', key: KEY_OK })[0]).toMatch(/<ref>/);
    expect(checkSupabaseEnv({ url: `${URL_OK}/rest/v1`, key: KEY_OK })[0]).toMatch(/path/);
    expect(checkSupabaseEnv({ url: `"${URL_OK}"`, key: KEY_OK })[0]).toMatch(/quotes/);
    expect(checkSupabaseEnv({ url: URL_OK, key: ` ${KEY_OK}` })[0]).toMatch(/whitespace/);
  });

  it('rejects random strings as keys', () => {
    expect(checkSupabaseEnv({ url: URL_OK, key: 'hello' })[0]).toMatch(/not a Supabase key/);
  });
});
