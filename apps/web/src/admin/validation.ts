import { CATEGORIES } from '../ui';
import type { Category } from '../ui';
import type { MessageKey } from '../i18n/messages';

// These checks repeat the database's own (see the challenges table); the database still decides,
// and its errors are shown too. They exist so a mistake is explained before anything is sent.

export interface ChallengeDraft {
  category: Category;
  titleNb: string;
  titleEn: string;
  bodyNb: string;
  bodyEn: string;
  difficulty: 1 | 2 | 3;
  points: number;
}

export type ChallengeField = 'titleNb' | 'titleEn' | 'bodyNb' | 'bodyEn' | 'difficulty' | 'points';
export type ChallengeErrors = Partial<Record<ChallengeField, MessageKey>>;

export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const BODY_MAX = 400;
export const POINTS_MIN = 5;
export const POINTS_MAX = 50;

/** Points suggested for a difficulty (decisions.md, 2026-10-16). */
export function defaultPoints(difficulty: 1 | 2 | 3): number {
  return difficulty * 10;
}

export function emptyDraft(category: Category = 'social'): ChallengeDraft {
  return {
    category,
    titleNb: '',
    titleEn: '',
    bodyNb: '',
    bodyEn: '',
    difficulty: 1,
    points: defaultPoints(1),
  };
}

export function validateChallenge(draft: ChallengeDraft): ChallengeErrors {
  const errors: ChallengeErrors = {};
  const title = (value: string) => {
    const n = value.trim().length;
    return n < TITLE_MIN || n > TITLE_MAX;
  };
  if (title(draft.titleNb)) errors.titleNb = 'admin.error.title';
  if (title(draft.titleEn)) errors.titleEn = 'admin.error.title';
  if (draft.bodyNb.trim().length > BODY_MAX) errors.bodyNb = 'admin.error.body';
  if (draft.bodyEn.trim().length > BODY_MAX) errors.bodyEn = 'admin.error.body';
  if (![1, 2, 3].includes(draft.difficulty)) errors.difficulty = 'admin.error.difficulty';
  if (!Number.isInteger(draft.points) || draft.points < POINTS_MIN || draft.points > POINTS_MAX) {
    errors.points = 'admin.error.points';
  }
  return errors;
}

// ---------- seasons ----------

export interface SeasonDraft {
  name: string;
  startsOn: string;
  endsOn: string;
  hour: number;
  status: 'draft' | 'active' | 'finished';
}

export type SeasonField = 'name' | 'startsOn' | 'endsOn' | 'hour';
export type SeasonErrors = Partial<Record<SeasonField, MessageKey>>;

function dayOfWeek(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
}

export const isMonday = (iso: string): boolean => dayOfWeek(iso) === 1;
export const isSunday = (iso: string): boolean => dayOfWeek(iso) === 0;

export function validateSeason(draft: SeasonDraft): SeasonErrors {
  const errors: SeasonErrors = {};
  const n = draft.name.trim().length;
  if (n < 2 || n > 60) errors.name = 'admin.error.season_name';
  if (!isMonday(draft.startsOn)) errors.startsOn = 'admin.error.monday';
  if (!isSunday(draft.endsOn)) errors.endsOn = 'admin.error.sunday';
  if (!errors.startsOn && !errors.endsOn && draft.endsOn <= draft.startsOn) {
    errors.endsOn = 'admin.error.after_start';
  }
  if (!Number.isInteger(draft.hour) || draft.hour < 0 || draft.hour > 23) {
    errors.hour = 'admin.error.hour';
  }
  return errors;
}

// ---------- points ----------

export function validateAdjustment(delta: number, note: string): MessageKey | null {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) return 'admin.error.delta';
  if (note.trim() === '' || note.trim().length > 120) return 'admin.error.note';
  return null;
}

export { CATEGORIES };
