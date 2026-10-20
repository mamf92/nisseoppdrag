export const CATEGORIES = [
  'social',
  'kindness',
  'learning',
  'collaboration',
  'holiday_fun',
] as const;
export type Category = (typeof CATEGORIES)[number];
