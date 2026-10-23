import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

const url: unknown = import.meta.env['VITE_SUPABASE_URL'];
// README and .env.example name the key VITE_SUPABASE_PUBLISHABLE_KEY; the old ANON name still works.
const key: unknown =
  import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || import.meta.env['VITE_SUPABASE_ANON_KEY'];

// The publishable (anon) key is meant for the browser; row level security does the protecting.
// Without both variables the app still renders and sign-in explains what is missing.
export const supabase: Db | null =
  typeof url === 'string' && url !== '' && typeof key === 'string' && key !== ''
    ? createClient<Database>(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;
