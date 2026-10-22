import type { Session } from '@supabase/supabase-js';
import type { Db } from './lib/supabase';

interface Failure {
  message: string;
  status?: number;
}

export interface FakeOptions {
  session?: boolean;
  /** What `rpc('me')` returns. */
  me?: unknown;
  otpError?: Failure | null;
  verifyError?: Failure | null;
  redeemError?: Failure | null;
}

export const MEMBER_ME = {
  member_id: 'm1',
  workplace_id: 'w1',
  workplace_name: 'Firma AS',
  role: 'player',
  nisse_name: 'Grøtnissen',
  avatar: { cap: '#b3262a', beard: '#f4efe4' },
  is_platform_admin: false,
};

// A small stand-in for the Supabase client: just the calls the auth code makes.
export function fakeClient(options: FakeOptions = {}) {
  let session: Session | null = options.session ? ({ access_token: 't' } as Session) : null;
  let me = options.me ?? null;
  const listeners: ((event: string, s: Session | null) => void)[] = [];
  const calls = {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    rpc: vi.fn(),
    signOut: vi.fn(),
  };
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: (cb: (event: string, s: Session | null) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithOtp: (args: unknown) => {
        calls.signInWithOtp(args);
        return Promise.resolve({ error: options.otpError ?? null });
      },
      verifyOtp: (args: unknown) => {
        calls.verifyOtp(args);
        if (options.verifyError) return Promise.resolve({ error: options.verifyError });
        session = { access_token: 't' } as Session;
        listeners.forEach((cb) => {
          cb('SIGNED_IN', session);
        });
        return Promise.resolve({ error: null });
      },
      signOut: () => {
        calls.signOut();
        session = null;
        return Promise.resolve({ error: null });
      },
    },
    rpc: (name: string, args?: unknown) => {
      calls.rpc(name, args);
      if (name === 'me') return Promise.resolve({ data: me, error: null });
      if (name === 'redeem_invite') {
        if (options.redeemError) return Promise.resolve({ data: null, error: options.redeemError });
        me = MEMBER_ME;
        return Promise.resolve({ data: { workplace_id: 'w1' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { client: client as unknown as Db, calls };
}
