import sprite from './sprite.svg?raw';
import { cx } from './cx';

export const ICON_NAMES = [
  'social',
  'kindness',
  'learning',
  'collaboration',
  'holiday_fun',
  'skip',
  'sack',
  'barn',
  'trophy',
  'medal',
  'cap',
  'key',
  'spoon',
  'lantern',
  'aurora',
  'fiddle',
  'owl',
  'sled',
  'gingerbread',
  'star',
  'farm',
  'crown',
  'butter',
  'candle',
  'tulip',
  'rosette',
  'rice',
  'milk',
  'cinnamon',
  'bowl_spoon',
  'butter_pat',
  'bowl',
  'hourglass',
  'check',
  'heart',
  'home',
  'reroll',
  'nisse',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

// The Karveskurd icons are cut out with SVG masks, which only work inside the same document,
// so the sprite is inlined once (render <IconSprite /> at the app root).
export function IconSprite() {
  return (
    <div aria-hidden="true" className="n-sprite" dangerouslySetInnerHTML={{ __html: sprite }} />
  );
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={cx('n-icon', className)} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}
