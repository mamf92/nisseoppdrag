import type { Page, Route } from '@playwright/test';

// Specs that need a signed-in member without a database answer the Supabase calls themselves.
// The URL is the one the build was made with (playwright.config.ts gives it a placeholder).
const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0] ?? 'local'}-auth-token`;

export type Reply = { status?: number; body: unknown };
export type RpcHandler = (args: Record<string, unknown>) => Reply;

export interface MockOptions {
  me: Record<string, unknown>;
  rpc?: Record<string, RpcHandler>;
  /** Rows by table for GET /rest/v1/<table>. */
  tables?: Record<string, unknown[]>;
}

export const MEMBER = {
  member_id: 'm1',
  workplace_id: 'w1',
  workplace_name: 'E2E-verkstedet',
  role: 'player',
  story: 'gaarden',
  nisse_name: 'Grøtnissen',
  farmer_name: null,
  name: 'Grøtnissen',
  is_platform_admin: false,
};

export async function signInAs(page: Page, { me, rpc = {}, tables = {} }: MockOptions) {
  const session = {
    access_token: 'e2e.access.token',
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: 'u1',
      aud: 'authenticated',
      email: 'e2e@example.com',
      app_metadata: {},
      user_metadata: {},
    },
  };
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key ?? '', value ?? '');
    },
    [STORAGE_KEY, JSON.stringify(session)],
  );
  const json = (route: Route, reply: Reply) =>
    route.fulfill({
      status: reply.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(reply.body),
    });
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/*`, async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const args = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    if (name === 'me') return json(route, { body: me });
    const handler = rpc[name];
    if (!handler) return json(route, { body: null });
    const reply = handler(args);
    // PostgREST reports a raised exception as an error body whose message is the text raised.
    return json(route, reply);
  });
  await page.route(`${SUPABASE_URL}/rest/v1/*`, (route) => {
    const table = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    return json(route, { body: tables[table] ?? [] });
  });
}

/** A PostgREST error for a database exception with this message. */
export function raise(message: string): Reply {
  return { status: 400, body: { code: 'P0001', message, details: null, hint: null } };
}
