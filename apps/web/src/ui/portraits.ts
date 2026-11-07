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
  'musa',
] as const;

export type PortraitId = (typeof PORTRAITS)[number];

const KNOWN: ReadonlySet<string> = new Set(PORTRAITS);

/** A portrait id the app has art for, or null (the drawn nisse) for anything else. */
export function asPortrait(value: unknown): PortraitId | null {
  return typeof value === 'string' && KNOWN.has(value) ? (value as PortraitId) : null;
}

export function portraitSrc(id: PortraitId, size: number): string {
  return `/art/portraits/${id}-${size > 64 ? '256' : '128'}.webp`;
}
