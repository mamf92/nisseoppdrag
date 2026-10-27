import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';

export type LeaderboardScope = 'week' | 'season';

export interface LeaderboardEntry {
  memberId: string;
  name: string;
  points: number;
  rank: number;
}

export function useLeaderboard(scope: LeaderboardScope) {
  const { client } = useAuth();
  return useQuery({
    queryKey: ['leaderboard', scope],
    enabled: client !== null,
    staleTime: 30_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.rpc('leaderboard', { p_scope: scope });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id,
        name: row.name,
        points: row.points,
        rank: row.rank,
      }));
    },
  });
}

export interface SeasonInfo {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'finished';
  startsOn: string;
  endsOn: string;
}

/** The season that matters now: the active one, else the latest. Tells "season over" from "not started". */
export function useCurrentSeason(enabled = true) {
  const { client } = useAuth();
  return useQuery({
    queryKey: ['season'],
    enabled: client !== null && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SeasonInfo | null> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client
        .from('seasons')
        .select('id, name, status, starts_on, ends_on')
        .order('ends_on', { ascending: false })
        .limit(5);
      if (error) throw error;
      const row = data.find((s) => s.status === 'active') ?? data[0];
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      };
    },
  });
}

export interface AchievementInfo {
  code: string;
  nameNb: string;
  nameEn: string;
  descriptionNb: string;
  descriptionEn: string;
  bonusPoints: number;
  isSecret: boolean;
  sort: number;
  unlockedAt: string | null;
}

/**
 * The catalog with the caller's unlocks. Secret badges the player has not unlocked are hidden by
 * row level security, so they are not in the list; the page shows the count of those as "?".
 */
export function useBadges() {
  const { client, state } = useAuth();
  const memberId = state.status === 'member' ? state.me.memberId : '';
  return useQuery({
    queryKey: ['my-badges', memberId],
    enabled: client !== null && memberId !== '',
    staleTime: 30_000,
    queryFn: async (): Promise<AchievementInfo[]> => {
      if (!client) throw new Error('not_configured');
      const [catalog, mine] = await Promise.all([
        client
          .from('achievements')
          .select(
            'code, name_nb, name_en, description_nb, description_en, bonus_points, is_secret, sort',
          )
          .order('sort'),
        client
          .from('member_achievements')
          .select('achievement_code, unlocked_at')
          .eq('member_id', memberId),
      ]);
      if (catalog.error) throw catalog.error;
      if (mine.error) throw mine.error;
      const unlocked = new Map(mine.data.map((row) => [row.achievement_code, row.unlocked_at]));
      return catalog.data.map((row) => ({
        code: row.code,
        nameNb: row.name_nb,
        nameEn: row.name_en,
        descriptionNb: row.description_nb,
        descriptionEn: row.description_en,
        bonusPoints: row.bonus_points,
        isSecret: row.is_secret,
        sort: row.sort,
        unlockedAt: unlocked.get(row.code) ?? null,
      }));
    },
  });
}

// Medallion file for each achievement code (public/art/badges/<file>-256.*).
const BADGE_FILES: Record<string, string> = {
  first_spoon: 'L-20-first_spoon',
  full_barn: 'L-21-full_barn',
  lantern: 'L-22-lantern',
  northern_light: 'L-23-northern_light',
  barn_dance: 'L-24-barn_dance',
  heart_of_gold: 'L-25-heart_of_gold',
  wise_nisse: 'L-26-wise_nisse',
  dugnad: 'L-27-dugnad',
  gingerbread: 'L-28-gingerbread',
  all_rounder: 'L-29-all_rounder',
  farm_nisse: 'L-2A-farm_nisse',
  chief_nisse: 'L-2B-chief_nisse',
  shaken_sack: 'L-2C-shaken_sack',
  butter_eye: 'L-2D-butter_eye',
  lucia: 'L-2E-lucia',
};

export function badgeFile(code: string): string {
  return BADGE_FILES[code] ?? 'L-20-first_spoon';
}
