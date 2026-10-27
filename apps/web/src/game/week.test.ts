import { countdown, hatchStates, isFullWeek, parseWeek } from './week';
import type { Slot } from './week';

function slot(n: number, status: Slot['status'] = 'open'): Slot {
  const categories = ['social', 'kindness', 'learning', 'collaboration', 'holiday_fun'] as const;
  return {
    assignmentId: `a${String(n)}`,
    slot: n,
    status,
    pointsAwarded: 0,
    category: categories[n - 1] ?? 'social',
    titleNb: 'T',
    titleEn: 'T',
    bodyNb: '',
    bodyEn: '',
    points: 10,
    difficulty: 1,
  };
}

describe('parseWeek', () => {
  it('reads an open week with its slots in order', () => {
    const week = parseWeek({
      state: 'open',
      week_start: '2026-12-07',
      closes_at: '2026-12-13T22:00:00+00:00',
      skip_left: false,
      reroll_left: true,
      slots: [
        {
          assignment_id: 'b',
          slot: 2,
          status: 'open',
          points_awarded: 0,
          category: 'kindness',
          title_nb: 'Hei',
          title_en: 'Hi',
          body_nb: '',
          body_en: '',
          points: 20,
          difficulty: 2,
        },
        {
          assignment_id: 'a',
          slot: 1,
          status: 'completed',
          points_awarded: 10,
          category: 'social',
          title_nb: 'Ha',
          title_en: 'Ha',
          points: 10,
          difficulty: 1,
        },
      ],
    });
    expect(week?.state).toBe('open');
    if (week?.state !== 'open') return;
    expect(week.slots.map((s) => s.slot)).toEqual([1, 2]);
    expect(week.skipLeft).toBe(false);
    expect(week.rerollLeft).toBe(true);
    expect(week.closesAt.toISOString()).toBe('2026-12-13T22:00:00.000Z');
  });

  it('reads a week with no season', () => {
    expect(parseWeek({ state: 'no_active_week' })).toEqual({ state: 'no_active_week' });
  });

  it('refuses nonsense and drops malformed slots', () => {
    expect(parseWeek(null)).toBeNull();
    expect(parseWeek({ state: 'open' })).toBeNull();
    const week = parseWeek({
      state: 'open',
      week_start: '2026-12-07',
      closes_at: '2026-12-13T22:00:00Z',
      slots: [{ slot: 1 }, 'x'],
    });
    expect(week?.state === 'open' && week.slots).toEqual([]);
  });
});

describe('hatchStates', () => {
  it('opens the first open mission and keeps the rest closed', () => {
    const slots = [slot(1, 'completed'), slot(2), slot(3), slot(4, 'skipped'), slot(5)];
    expect(hatchStates(slots)).toEqual(['done', 'open', 'closed', 'skipped', 'closed']);
  });

  it('leaves a slot the catalog could not fill closed', () => {
    expect(hatchStates([slot(1), slot(3)])).toEqual([
      'open',
      'closed',
      'closed',
      'closed',
      'closed',
    ]);
  });
});

describe('isFullWeek', () => {
  it('needs all five completed', () => {
    const all = [1, 2, 3, 4, 5].map((n) => slot(n, 'completed'));
    expect(isFullWeek(all)).toBe(true);
    expect(isFullWeek(all.slice(1))).toBe(false);
    expect(isFullWeek([...all.slice(0, 4), slot(5, 'skipped')])).toBe(false);
  });
});

describe('countdown', () => {
  const closes = new Date('2026-12-13T22:59:00Z');
  it('splits the time left', () => {
    expect(countdown(closes, new Date('2026-12-10T20:00:00Z'))).toEqual({
      days: 3,
      hours: 2,
      minutes: 59,
      over: false,
    });
  });
  it('is over once the time has passed', () => {
    expect(countdown(closes, closes).over).toBe(true);
  });
});
