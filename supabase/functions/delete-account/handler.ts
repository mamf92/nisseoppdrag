// The logic of the delete-account function, with its dependencies passed in so that it can be
// tested without Deno or a database. index.ts wires it to Supabase.

export interface Deps {
  /** The user behind a bearer token, or null when the token is not valid. */
  userFor: (token: string) => Promise<{ id: string } | null>;
  /** True when the user is the only admin of a group that still has other members. */
  isLastAdminOfLiveGroup: (userId: string) => Promise<boolean>;
  /** Deletes the auth user; rows in public.* follow through on delete cascade. */
  deleteUser: (userId: string) => Promise<{ message: string } | null>;
}

const HEADERS = {
  // Authentication is a bearer token, never a cookie, so any origin may call (and gains nothing).
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

function reply(status: number, error?: string): Response {
  if (status === 204) return new Response(null, { status, headers: HEADERS });
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...HEADERS, 'content-type': 'application/json' },
  });
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return reply(405, 'method_not_allowed');

  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '');
  const token = match?.[1];
  if (!token) return reply(401, 'not_signed_in');
  const user = await deps.userFor(token).catch(() => null);
  if (!user) return reply(401, 'not_signed_in');

  if (await deps.isLastAdminOfLiveGroup(user.id)) return reply(409, 'last_admin');
  const failure = await deps.deleteUser(user.id);
  if (failure) return reply(500, 'delete_failed');
  return reply(204);
}
