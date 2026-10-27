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
  /** Fails `rpc('me')` until `recover()` is called. */
  meError?: Failure | null;
  otpError?: Failure | null;
  verifyError?: Failure | null;
  redeemError?: Failure | null;
  /** What `rpc('taken_names')` returns: the names already in use in the group. */
  taken?: string[];
  takenError?: Failure | null;
  /** Answers for other RPCs by name; a thrown-away default is `{ data: null, error: null }`. */
  /** What `functions.invoke('delete-account')` resolves with. */
  deleteAccount?: { error: unknown } | null;
  /** Rows for table reads by table name. */
  tables?: Record<string, unknown[]>;
  rpc?: Record<string, (args: unknown) => { data: unknown; error: Failure | null }>;
}

export const MEMBER_ME = {
  member_id: 'm1',
  workplace_id: 'w1',
  workplace_name: 'Firma AS',
  role: 'player',
  story: 'gaarden',
  nisse_name: 'Grøtnissen',
  farmer_name: null,
  name: 'Grøtnissen',
  is_platform_admin: false,
};

// A small stand-in for the Supabase client: just the calls the auth code makes.
export function fakeClient(options: FakeOptions = {}) {
  let session: Session | null = options.session ? ({ access_token: 't' } as Session) : null;
  let me = options.me ?? null;
  let meError = options.meError ?? null;
  const listeners: ((event: string, s: Session | null) => void)[] = [];
  const calls = {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    rpc: vi.fn(),
    signOut: vi.fn(),
    invoke: vi.fn(),
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
      if (name === 'me') return Promise.resolve({ data: meError ? null : me, error: meError });
      if (name === 'redeem_invite') {
        if (options.redeemError) return Promise.resolve({ data: null, error: options.redeemError });
        me = MEMBER_ME;
        return Promise.resolve({ data: { workplace_id: 'w1' }, error: null });
      }
      if (name === 'taken_names') {
        if (options.takenError) return Promise.resolve({ data: null, error: options.takenError });
        return Promise.resolve({ data: options.taken ?? [], error: null });
      }
      const handler = options.rpc?.[name];
      if (handler) return Promise.resolve(handler(args));
      return Promise.resolve({ data: null, error: null });
    },
    functions: {
      invoke: (name: string, args?: unknown) => {
        calls.invoke(name, args);
        return Promise.resolve({ data: null, error: options.deleteAccount?.error ?? null });
      },
    },
    // A table read is a chain of select/order/limit/eq ending in an await.
    from: (table: string) => {
      const rows = options.tables?.[table] ?? [];
      const chain: Record<string, unknown> = {
        then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      };
      for (const method of ['select', 'order', 'limit', 'eq']) chain[method] = () => chain;
      return chain;
    },
  };
  const recover = () => {
    meError = null;
  };
  return { client: client as unknown as Db, calls, recover };
}
