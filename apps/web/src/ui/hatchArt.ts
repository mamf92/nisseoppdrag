import type { Theme } from '../themes/theme';
import type { MessageKey } from '../i18n/messages';
import type { IconName } from './Icon';
import type { Category } from './categories';

// Each hatch brings one thing, fixed per category (decisions.md, 2026-10-20).
// Låven gathers ingredients for the nisse's porridge; Gården brings the family home.
export type HatchArt =
  | { kind: 'icon'; icon: IconName; nameKey: MessageKey }
  | { kind: 'portrait'; file: string; nameKey: MessageKey };

const LAAVEN: Record<Category, HatchArt> = {
  social: { kind: 'icon', icon: 'milk', nameKey: 'item.laaven.social' },
  kindness: { kind: 'icon', icon: 'butter_pat', nameKey: 'item.laaven.kindness' },
  learning: { kind: 'icon', icon: 'cinnamon', nameKey: 'item.laaven.learning' },
  collaboration: { kind: 'icon', icon: 'rice', nameKey: 'item.laaven.collaboration' },
  holiday_fun: { kind: 'icon', icon: 'bowl_spoon', nameKey: 'item.laaven.holiday_fun' },
};

const GAARDEN: Record<Category, HatchArt> = {
  social: { kind: 'portrait', file: 'G-20-lyktenissen', nameKey: 'item.gaarden.social' },
  kindness: { kind: 'portrait', file: 'G-21-grotnissa', nameKey: 'item.gaarden.kindness' },
  learning: { kind: 'portrait', file: 'G-22-nissefar', nameKey: 'item.gaarden.learning' },
  collaboration: {
    kind: 'portrait',
    file: 'G-23-snonissen',
    nameKey: 'item.gaarden.collaboration',
  },
  holiday_fun: { kind: 'portrait', file: 'G-24-lavenissen', nameKey: 'item.gaarden.holiday_fun' },
};

export function hatchArt(theme: Theme, category: Category): HatchArt {
  return (theme === 'laaven' ? LAAVEN : GAARDEN)[category];
}
