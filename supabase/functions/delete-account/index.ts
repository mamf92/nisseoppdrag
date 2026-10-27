import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handle } from './handler.ts';

// Deletes the caller's own account. The service-role key exists only here, as a function secret
// that Supabase injects; it never reaches the browser. The caller is identified from the token the
// Auth server confirms, never from anything in the request body.
const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((request) =>
  handle(request, {
    async userFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },
    async isLastAdminOfLiveGroup(userId) {
      const me = await admin
        .from('members')
        .select('workplace_id, role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!me.data || me.data.role !== 'admin') return false;
      const others = await admin
        .from('members')
        .select('id, role', { count: 'exact' })
        .eq('workplace_id', me.data.workplace_id)
        .neq('user_id', userId);
      const rows = others.data ?? [];
      return rows.length > 0 && !rows.some((row) => row.role === 'admin');
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      return error ? { message: error.message } : null;
    },
  }),
);
