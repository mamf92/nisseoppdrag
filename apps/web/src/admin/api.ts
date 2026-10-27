import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import type { Database } from '../lib/database.types';
import type { ChallengeDraft, SeasonDraft } from './validation';
import { CATEGORIES } from '../ui';
import type { Category } from '../ui';

type Json = Database['public']['Functions']['admin_stats']['Returns'];

function useClient() {
  const { client } = useAuth();
  return client;
}

function useWorkplaceId(): string {
  const { state } = useAuth();
  return state.status === 'member' ? state.me.workplaceId : '';
}

const key = (workplaceId: string, name: string) => ['admin', workplaceId, name] as const;

// ---------- overview ----------

export interface AdminStats {
  members: number;
  activeThisWeek: number;
  skips: number;
  rerolls: number;
  byCategory: Record<Category, number>;
  catalogLow: Category[];
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export function parseStats(value: Json): AdminStats {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  const by =
    typeof record['by_category'] === 'object' &&
    record['by_category'] !== null &&
    !Array.isArray(record['by_category'])
      ? record['by_category']
      : {};
  const low = Array.isArray(record['catalog_low']) ? record['catalog_low'] : [];
  return {
    members: num(record['members']),
    activeThisWeek: num(record['active_this_week']),
    skips: num(record['skips']),
    rerolls: num(record['rerolls']),
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, num(by[c])])) as Record<
      Category,
      number
    >,
    catalogLow: low.filter((c): c is Category => (CATEGORIES as readonly unknown[]).includes(c)),
  };
}

export function useAdminStats() {
  const client = useClient();
  const wp = useWorkplaceId();
  return useQuery({
    queryKey: key(wp, 'stats'),
    enabled: client !== null && wp !== '',
    queryFn: async () => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.rpc('admin_stats');
      if (error) throw error;
      return parseStats(data);
    },
  });
}

// ---------- challenges ----------

export interface AdminChallenge extends ChallengeDraft {
  id: string;
  isActive: boolean;
  archived: boolean;
}

export function useChallenges() {
  const client = useClient();
  const wp = useWorkplaceId();
  return useQuery({
    queryKey: key(wp, 'challenges'),
    enabled: client !== null && wp !== '',
    queryFn: async (): Promise<AdminChallenge[]> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client
        .from('challenges')
        .select('*')
        .order('category')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        category: row.category,
        titleNb: row.title_nb,
        titleEn: row.title_en,
        bodyNb: row.body_nb,
        bodyEn: row.body_en,
        difficulty: row.difficulty === 3 ? 3 : row.difficulty === 2 ? 2 : 1,
        points: row.points,
        isActive: row.is_active,
        archived: row.archived_at !== null,
      }));
    },
  });
}

function row(draft: ChallengeDraft) {
  return {
    category: draft.category,
    title_nb: draft.titleNb.trim(),
    title_en: draft.titleEn.trim(),
    body_nb: draft.bodyNb.trim(),
    body_en: draft.bodyEn.trim(),
    difficulty: draft.difficulty,
    points: draft.points,
  };
}

export function useSaveChallenge() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: ChallengeDraft }) => {
      if (!client) throw new Error('not_configured');
      const { error } = id
        ? await client.from('challenges').update(row(draft)).eq('id', id)
        : await client.from('challenges').insert({ ...row(draft), workplace_id: wp });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

export function useImportChallenges() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (drafts: ChallengeDraft[]) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client
        .from('challenges')
        .insert(drafts.map((draft) => ({ ...row(draft), workplace_id: wp })));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

export function useSetChallengeState() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      change,
    }: {
      id: string;
      change: { isActive: boolean } | { archived: boolean };
    }) => {
      if (!client) throw new Error('not_configured');
      const patch =
        'isActive' in change
          ? { is_active: change.isActive }
          : { archived_at: change.archived ? new Date().toISOString() : null };
      const { error } = await client.from('challenges').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

// ---------- seasons ----------

export interface AdminSeason extends SeasonDraft {
  id: string;
}

export function useSeasons() {
  const client = useClient();
  const wp = useWorkplaceId();
  return useQuery({
    queryKey: key(wp, 'seasons'),
    enabled: client !== null && wp !== '',
    queryFn: async (): Promise<AdminSeason[]> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client
        .from('seasons')
        .select('*')
        .order('starts_on', { ascending: false });
      if (error) throw error;
      return data.map((s) => ({
        id: s.id,
        name: s.name,
        startsOn: s.starts_on,
        endsOn: s.ends_on,
        hour: s.distribution_hour,
        status: s.status,
      }));
    },
  });
}

export function useSaveSeason() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: SeasonDraft }) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client.rpc('admin_upsert_season', {
        // The function creates a season when it gets no id.
        p_id: id as string,
        p_name: draft.name.trim(),
        p_starts: draft.startsOn,
        p_ends: draft.endsOn,
        p_hour: draft.hour,
        p_status: draft.status,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

// ---------- members, invites, points ----------

export interface AdminMember {
  id: string;
  name: string;
  role: 'player' | 'admin';
  story: 'gaarden' | 'laaven';
  joinedAt: string;
}

export function useMembers() {
  const client = useClient();
  const wp = useWorkplaceId();
  return useQuery({
    queryKey: key(wp, 'members'),
    enabled: client !== null && wp !== '',
    queryFn: async (): Promise<AdminMember[]> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client
        .from('members')
        .select('id, nisse_name, farmer_name, story, role, joined_at')
        .order('joined_at');
      if (error) throw error;
      return data.map((m) => ({
        id: m.id,
        name:
          (m.story === 'laaven' ? m.farmer_name : m.nisse_name) ??
          m.nisse_name ??
          m.farmer_name ??
          '',
        role: m.role,
        story: m.story,
        joinedAt: m.joined_at,
      }));
    },
  });
}

export interface AdminInvite {
  id: string;
  role: 'player' | 'admin';
  expiresAt: string;
  uses: number;
  maxUses: number;
}

export function useInvites() {
  const client = useClient();
  const wp = useWorkplaceId();
  return useQuery({
    queryKey: key(wp, 'invites'),
    enabled: client !== null && wp !== '',
    queryFn: async (): Promise<AdminInvite[]> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client
        .from('invites')
        .select('id, role, expires_at, max_uses, uses')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map((i) => ({
        id: i.id,
        role: i.role,
        expiresAt: i.expires_at,
        uses: i.uses,
        maxUses: i.max_uses,
      }));
    },
  });
}

export function useCreateInvite() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, days }: { role: 'player' | 'admin'; days: number }) => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.rpc('admin_create_invite', {
        p_role: role,
        p_days: days,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

export function useSetRole() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ member, role }: { member: string; role: 'player' | 'admin' }) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client.rpc('admin_set_role', { p_member: member, p_role: role });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

export function useRemoveMember() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (member: string) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client.rpc('admin_remove_member', { p_member: member });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', wp] }),
  });
}

export function useAdjustPoints() {
  const client = useClient();
  const wp = useWorkplaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      member,
      delta,
      note,
    }: {
      member: string;
      delta: number;
      note: string;
    }) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client.rpc('admin_adjust_points', {
        p_member: member,
        p_delta: delta,
        p_note: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', wp] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

// ---------- log ----------

export interface AuditEntry {
  id: number;
  action: string;
  target: string | null;
  at: string;
}

export function useAuditLog() {
  const client = useClient();
  const wp = useWorkplaceId();
  return useQuery({
    queryKey: key(wp, 'log'),
    enabled: client !== null && wp !== '',
    queryFn: async (): Promise<AuditEntry[]> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client
        .from('audit_log')
        .select('id, action, target, at')
        .order('at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}
