import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Db } from '../lib/supabase';

export type Story = 'gaarden' | 'laaven';

export interface Me {
  memberId: string;
  workplaceId: string;
  workplaceName: string;
  role: 'player' | 'admin';
  /** The story the player is in right now. */
  story: Story;
  /** The name for the current story: a farmer name in Låven, a nisse name in Gården. */
  name: string;
  nisseName: string | null;
  farmerName: string | null;
  isPlatformAdmin: boolean;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  // Signed in, but not a member of any workplace yet: the next step is onboarding.
  | { status: 'signedIn'; me: null }
  | { status: 'member'; me: Me }
  // Membership could not be loaded (network or server); not the same as having none.
  | { status: 'error' };

export interface AuthError {
  message: string;
  status?: number | undefined;
  code?: string | undefined;
}

interface AuthContextValue {
  state: AuthState;
  /** The database client, for the game screens; null when the app has no Supabase setup. */
  client: Db | null;
  sendCode: (email: string) => Promise<AuthError | null>;
  verifyCode: (email: string, code: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  /** Loads the session and membership again, e.g. after a failed load. */
  retry: () => Promise<void>;
  /** Joins a workplace and loads the new membership. */
  redeemInvite: (code: string, story: Story, name: string) => Promise<AuthError | null>;
  /** Whether this account can make a game now: 'ok', 'full' (all places taken) or 'limit'. */
  canCreateGame: () => Promise<{ state: 'ok' | 'full' | 'limit' } | { error: AuthError }>;
  /** Makes a game with the caller as its admin, playing under `name` in `story`. */
  createWorkplace: (gameName: string, story: Story, name: string) => Promise<AuthError | null>;
  /** The names already in use (lower-cased) in the group behind an invite code. */
  takenNames: (code: string) => Promise<{ names: Set<string> } | { error: AuthError }>;
  /** Deletes the account and everything in it (the Edge Function), then signs out. */
  deleteAccount: () => Promise<AuthError | null>;
  /** Switches story; the name is for that story, and can be left out when the player has one. */
  updateProfile: (story: Story, name?: string) => Promise<AuthError | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// public.me() returns null for a signed-in user without a membership.
export function parseMe(value: unknown): Me | null {
  if (!isRecord(value)) return null;
  const memberId = str(value['member_id']);
  const workplaceId = str(value['workplace_id']);
  const name = str(value['name']);
  if (!memberId || !workplaceId || !name) return null;
  return {
    memberId,
    workplaceId,
    workplaceName: str(value['workplace_name']) ?? '',
    role: value['role'] === 'admin' ? 'admin' : 'player',
    story: value['story'] === 'laaven' ? 'laaven' : 'gaarden',
    name,
    nisseName: str(value['nisse_name']) ?? null,
    farmerName: str(value['farmer_name']) ?? null,
    isPlatformAdmin: value['is_platform_admin'] === true,
  };
}

async function loadState(client: Db, session: Session | null): Promise<AuthState> {
  if (!session) return { status: 'signedOut' };
  const { data, error } = await client.rpc('me');
  if (error) return { status: 'error' };
  const me = parseMe(data);
  return me ? { status: 'member', me } : { status: 'signedIn', me: null };
}

export function AuthProvider({
  children,
  client = supabase,
}: {
  children: ReactNode;
  client?: Db | null;
}) {
  const [state, setState] = useState<AuthState>(
    client ? { status: 'loading' } : { status: 'signedOut' },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    const apply = (session: Session | null) => {
      void loadState(client, session).then((next) => {
        if (active) setState(next);
      });
    };
    void client.auth.getSession().then(({ data }) => {
      apply(data.session);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // The initial session is read above; token refreshes do not change who the user is.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      apply(session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const reload = useCallback(async () => {
    if (!client) return;
    const { data } = await client.auth.getSession();
    setState(await loadState(client, data.session));
  }, [client]);

  const value = useMemo<AuthContextValue>(() => {
    const missing: AuthError = { message: 'not_configured' };
    return {
      state,
      client,
      retry: reload,
      async sendCode(email) {
        if (!client) return missing;
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });
        return error;
      },
      async verifyCode(email, code) {
        if (!client) return missing;
        const { error } = await client.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'email',
        });
        return error;
      },
      async signOut() {
        if (client) await client.auth.signOut();
        setState({ status: 'signedOut' });
      },
      async redeemInvite(code, story, name) {
        if (!client) return missing;
        const { error } = await client.rpc('redeem_invite', {
          p_code: code,
          p_story: story,
          p_name: name.trim(),
        });
        if (error) return error;
        await reload();
        return null;
      },
      async canCreateGame() {
        if (!client) return { error: missing };
        const { data, error } = await client.rpc('can_create_game');
        if (error) return { error };
        return { state: data === 'full' || data === 'limit' ? data : 'ok' };
      },
      async createWorkplace(gameName, story, name) {
        if (!client) return missing;
        const { error } = await client.rpc('create_workplace', {
          p_game_name: gameName.trim(),
          p_story: story,
          p_member_name: name.trim(),
        });
        if (error) return error;
        await reload();
        return null;
      },
      async takenNames(code) {
        if (!client) return { error: missing };
        const { data, error } = await client.rpc('taken_names', { p_code: code.trim() });
        if (error) return { error };
        return {
          names: new Set(Array.isArray(data) ? data.map((n) => n.toLowerCase()) : []),
        };
      },
      async deleteAccount() {
        if (!client) return missing;
        const result: { error: unknown } = await client.functions.invoke<unknown>(
          'delete-account',
          {
            method: 'POST',
          },
        );
        const { error } = result;
        if (error) {
          // A refused call carries the function's own error code in the response body.
          if (error instanceof FunctionsHttpError) {
            const response = error.context as Response;
            const body: unknown = await response.json().catch(() => null);
            const code = isRecord(body) ? str(body['error']) : undefined;
            if (code) return { message: code, status: response.status };
          }
          return { message: error instanceof Error ? error.message : 'unknown' };
        }
        // The user no longer exists, so there is no server-side session left to revoke.
        await client.auth.signOut({ scope: 'local' });
        setState({ status: 'signedOut' });
        return null;
      },
      async updateProfile(story, name) {
        if (!client) return missing;
        const { error } = await client.rpc('update_profile', {
          p_story: story,
          ...(name === undefined ? {} : { p_name: name.trim() }),
        });
        if (error) return error;
        await reload();
        return null;
      },
    };
  }, [client, state, reload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
