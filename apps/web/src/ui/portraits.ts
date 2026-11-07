// The player portraits: painted heads cropped from the approved character sheets
// (scripts/portraits/build_portraits.py). The same ids live in public.portraits, which is what
// the server checks a choice against. Order is the order in the picker.
export const PORTRAITS = [
  'lyktenissen-1',
  'lyktenissen-2',
  'grotnissa-1',
  'grotnissa-2',
  'grotnissa-3',
  'lavenissen-1',
  'lavenissen-2',
  'lavenissen-3',
  'snonissen-1',
  'snonissen-2',
  'nissefar-1',
  'nissefar-3',
  'fjosnissen-1',
  'fjosnissen-2',
  'fjosnissen-3',
  'gamlenissen-1',
  'gamlenissen-2',
  'fjoskatten',
  'fjoskatten-2',
  'musa',
  'musa-2',
] as const;

export type PortraitId = (typeof PORTRAITS)[number];

const KNOWN: ReadonlySet<string> = new Set(PORTRAITS);

/** A portrait id the app has art for, or null for anything else. */
export function asPortrait(value: unknown): PortraitId | null {
  return typeof value === 'string' && KNOWN.has(value) ? (value as PortraitId) : null;
}

/**
 * The portrait a player has before choosing one: picked from the set by their member id, so it
 * is the same on every screen and device, and players do not all start with the same face.
 */
export function defaultPortrait(seed: string): PortraitId {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return PORTRAITS[hash % PORTRAITS.length] ?? PORTRAITS[0];
}

export function portraitSrc(id: PortraitId, size: number): string {
  const file = size > 128 ? '512' : size > 64 ? '256' : '128';
  return `/art/portraits/${id}-${file}.webp`;
}
