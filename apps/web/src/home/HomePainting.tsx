import type { Theme } from '../themes/theme';

// The painting on Home when no week is open: the farm asleep between weeks, or the season put to bed.
const PAINTINGS = {
  laaven: { none: 'R-13-stable-sleep', over: 'R-14-season-over' },
  gaarden: { none: 'L-13-empty-asleep', over: 'L-14b-season-over-wide' },
} as const;

export function HomePainting({ theme, finished }: { theme: Theme; finished: boolean }) {
  const base = `/art/home/${PAINTINGS[theme][finished ? 'over' : 'none']}`;
  return (
    <picture>
      <source type="image/avif" srcSet={`${base}@1x.avif 1x, ${base}@2x.avif 2x`} />
      <img
        className="n-note__painting"
        src={`${base}@1x.webp`}
        srcSet={`${base}@1x.webp 1x, ${base}@2x.webp 2x`}
        alt=""
        decoding="async"
      />
    </picture>
  );
}
