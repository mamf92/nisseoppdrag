import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { gameErrorKey, shouldRefetch } from './errors';
import { parseWeek } from './week';
import type { Week } from './week';
import { useToast } from '../ui';
import { useT } from '../i18n/I18nProvider';

export const UNDO_MS = 4000;

export const weekKey = (memberId: string) => ['week', memberId] as const;

/** Today's week from `ensure_my_week`, which also creates it for a late joiner. */
export function useWeekQuery() {
  const { client, state } = useAuth();
  const memberId = state.status === 'member' ? state.me.memberId : '';
  return useQuery({
    queryKey: weekKey(memberId),
    enabled: client !== null && memberId !== '',
    queryFn: async (): Promise<Week> => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.rpc('ensure_my_week');
      if (error) throw error;
      const week = parseWeek(data);
      if (!week) throw new Error('bad_week');
      return week;
    },
    // A week only changes through the player's own actions or the Monday tick.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export interface CompleteResult {
  points: number;
  newAchievements: string[];
}

function parseComplete(value: unknown): CompleteResult {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const points = typeof record['points'] === 'number' ? record['points'] : 0;
  const list: unknown[] = Array.isArray(record['new_achievements'])
    ? record['new_achievements']
    : [];
  return { points, newAchievements: list.filter((c): c is string => typeof c === 'string') };
}

type WeekPatch = (week: Extract<Week, { state: 'open' }>) => Extract<Week, { state: 'open' }>;

/**
 * The player's three actions on a mission. Complete waits `UNDO_MS` so a mis-tap can be taken
 * back; skip is optimistic and rolls back on an error code; reroll needs the server's pick, so it
 * only marks the card busy. The database remains the judge of every rule.
 */
export function useWeekActions(onResult: (result: CompleteResult) => void) {
  const { client, state } = useAuth();
  const memberId = state.status === 'member' ? state.me.memberId : '';
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useT();
  const key = weekKey(memberId);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [undoable, setUndoable] = useState<ReadonlySet<string>>(new Set());
  const [shaken, setShaken] = useState<number | null>(null);
  const timers = useRef(new Map<string, number>());

  const patch = useCallback(
    (fn: WeekPatch) => {
      queryClient.setQueryData<Week>(key, (week) => (week?.state === 'open' ? fn(week) : week));
    },
    [queryClient, key],
  );

  const fail = useCallback(
    (error: { message?: string }) => {
      toast.show(t(gameErrorKey(error)), 'error');
      if (shouldRefetch(error)) void queryClient.invalidateQueries({ queryKey: key });
    },
    [toast, t, queryClient, key],
  );

  const refreshScores = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    void queryClient.invalidateQueries({ queryKey: ['my-badges'] });
    void queryClient.invalidateQueries({ queryKey: ['my-points'] });
  }, [queryClient]);

  const complete = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.rpc('complete_assignment', {
        p_assignment: assignmentId,
      });
      if (error) throw error;
      return parseComplete(data);
    },
    onSuccess: (result, assignmentId) => {
      patch((week) => ({
        ...week,
        slots: week.slots.map((slot) =>
          slot.assignmentId === assignmentId
            ? { ...slot, status: 'completed', pointsAwarded: result.points }
            : slot,
        ),
      }));
      refreshScores();
      onResult(result);
    },
    onError: fail,
    onSettled: (_data, _error, assignmentId) => {
      setPending((all) => {
        const next = new Set(all);
        next.delete(assignmentId);
        return next;
      });
    },
  });

  const skip = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client.rpc('skip_assignment', { p_assignment: assignmentId });
      if (error) throw error;
    },
    onMutate: async (assignmentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      patch((week) => ({
        ...week,
        skipLeft: false,
        slots: week.slots.map((slot) =>
          slot.assignmentId === assignmentId ? { ...slot, status: 'skipped' } : slot,
        ),
      }));
    },
    onError: (error, assignmentId) => {
      // Undo only this skip; a completion that succeeded meanwhile must stay.
      patch((week) => ({
        ...week,
        skipLeft: true,
        slots: week.slots.map((slot) =>
          slot.assignmentId === assignmentId && slot.status === 'skipped'
            ? { ...slot, status: 'open' }
            : slot,
        ),
      }));
      fail(error);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onSuccess: refreshScores,
  });

  // Taking a skip back is optimistic too; the database refuses it once the week has closed.
  const unskip = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!client) throw new Error('not_configured');
      const { error } = await client.rpc('unskip_assignment', { p_assignment: assignmentId });
      if (error) throw error;
    },
    onMutate: async (assignmentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      patch((week) => ({
        ...week,
        skipLeft: true,
        slots: week.slots.map((slot) =>
          slot.assignmentId === assignmentId ? { ...slot, status: 'open' } : slot,
        ),
      }));
    },
    onError: (error, assignmentId) => {
      patch((week) => ({
        ...week,
        skipLeft: false,
        slots: week.slots.map((slot) =>
          slot.assignmentId === assignmentId && slot.status === 'open'
            ? { ...slot, status: 'skipped' }
            : slot,
        ),
      }));
      fail(error);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const reroll = useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string; slot: number }) => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.rpc('reroll_assignment', {
        p_assignment: assignmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, { slot }) => {
      setShaken(slot);
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: fail,
  });

  const startComplete = useCallback(
    (assignmentId: string) => {
      if (timers.current.has(assignmentId)) return;
      setPending((all) => new Set(all).add(assignmentId));
      setUndoable((all) => new Set(all).add(assignmentId));
      timers.current.set(
        assignmentId,
        window.setTimeout(() => {
          timers.current.delete(assignmentId);
          setUndoable((all) => {
            const next = new Set(all);
            next.delete(assignmentId);
            return next;
          });
          complete.mutate(assignmentId);
        }, UNDO_MS),
      );
    },
    [complete],
  );

  const undoComplete = useCallback((assignmentId: string) => {
    const timer = timers.current.get(assignmentId);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timers.current.delete(assignmentId);
    for (const set of [setPending, setUndoable]) {
      set((all) => {
        const next = new Set(all);
        next.delete(assignmentId);
        return next;
      });
    }
  }, []);

  // Leaving the page must not lose a completion the player has already seen as done.
  const completeRef = useRef(complete.mutate);
  useEffect(() => {
    completeRef.current = complete.mutate;
  });
  useEffect(() => {
    const active = timers.current;
    const flush = () => {
      active.forEach((timer, assignmentId) => {
        window.clearTimeout(timer);
        completeRef.current(assignmentId);
      });
      active.clear();
    };
    // Closing or reloading the tab does not unmount React, so send on pagehide too (best effort).
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return {
    /** Assignment ids that look done but are still inside the undo window or being sent. */
    pending,
    /** The subset that can still be taken back: the undo window has not yet closed. */
    undoable,
    /** The slot whose card should shake once, after a reroll. */
    shaken,
    busy: skip.isPending || unskip.isPending || reroll.isPending,
    startComplete,
    undoComplete,
    skip: skip.mutate,
    unskip: unskip.mutate,
    reroll: (assignmentId: string, slot: number) => {
      reroll.mutate({ assignmentId, slot });
    },
  };
}
