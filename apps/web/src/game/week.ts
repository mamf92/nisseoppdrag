import type { HatchState } from '../ui';
import { CATEGORIES } from '../ui';
import type { Category } from '../ui';

export type SlotStatus = 'open' | 'completed' | 'skipped';

export interface Slot {
  assignmentId: string;
  /** 1 to 5; slot n is always category n. */
  slot: number;
  status: SlotStatus;
  pointsAwarded: number;
  category: Category;
  titleNb: string;
  titleEn: string;
  bodyNb: string;
  bodyEn: string;
  points: number;
  difficulty: 1 | 2 | 3;
}

export type Week =
  | { state: 'no_active_week' }
  | {
      state: 'open';
      weekStart: string;
      closesAt: Date;
      skipLeft: boolean;
      rerollLeft: boolean;
      slots: Slot[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

function parseSlot(value: unknown): Slot | null {
  if (!isRecord(value)) return null;
  const { assignment_id, slot, status, category, difficulty, points } = value;
  if (typeof assignment_id !== 'string' || typeof slot !== 'number') return null;
  if (status !== 'open' && status !== 'completed' && status !== 'skipped') return null;
  if (!isCategory(category) || typeof points !== 'number') return null;
  const text = (key: string) => (typeof value[key] === 'string' ? value[key] : '');
  return {
    assignmentId: assignment_id,
    slot,
    status,
    pointsAwarded: typeof value['points_awarded'] === 'number' ? value['points_awarded'] : 0,
    category,
    titleNb: text('title_nb'),
    titleEn: text('title_en'),
    bodyNb: text('body_nb'),
    bodyEn: text('body_en'),
    points,
    difficulty: difficulty === 3 ? 3 : difficulty === 2 ? 2 : 1,
  };
}

// public.ensure_my_week() returns {state:'no_active_week'} or {state:'open', ...}.
export function parseWeek(value: unknown): Week | null {
  if (!isRecord(value)) return null;
  if (value['state'] === 'no_active_week') return { state: 'no_active_week' };
  if (value['state'] !== 'open') return null;
  const weekStart = value['week_start'];
  const closes = value['closes_at'];
  if (typeof weekStart !== 'string' || typeof closes !== 'string') return null;
  const closesAt = new Date(closes);
  if (Number.isNaN(closesAt.getTime())) return null;
  const rawSlots: unknown[] = Array.isArray(value['slots']) ? value['slots'] : [];
  const slots = rawSlots
    .map(parseSlot)
    .filter((slot): slot is Slot => slot !== null)
    .sort((a, b) => a.slot - b.slot);
  return {
    state: 'open',
    weekStart,
    closesAt,
    skipLeft: value['skip_left'] !== false,
    rerollLeft: value['reroll_left'] !== false,
    slots,
  };
}

/** The slot for category n, or undefined when the catalog left it empty. */
export function slotAt(slots: readonly Slot[], index: number): Slot | undefined {
  return slots.find((slot) => slot.slot === index + 1);
}

// The hatch row: the first open mission is "open" (today's hatch); the rest wait, closed.
export function hatchStates(slots: readonly Slot[]): HatchState[] {
  let firstOpenSeen = false;
  return CATEGORIES.map((_, index) => {
    const slot = slotAt(slots, index);
    if (!slot) return 'closed';
    if (slot.status === 'completed') return 'done';
    if (slot.status === 'skipped') return 'skipped';
    if (!firstOpenSeen) {
      firstOpenSeen = true;
      return 'open';
    }
    return 'closed';
  });
}

export function completedCount(slots: readonly Slot[]): number {
  return slots.filter((slot) => slot.status === 'completed').length;
}

/** All five slots exist and are completed: the barn-door moment. */
export function isFullWeek(slots: readonly Slot[]): boolean {
  return slots.length === CATEGORIES.length && completedCount(slots) === CATEGORIES.length;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  over: boolean;
}

export function countdown(closesAt: Date, now: Date): Countdown {
  const ms = closesAt.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, over: true };
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    over: false,
  };
}
