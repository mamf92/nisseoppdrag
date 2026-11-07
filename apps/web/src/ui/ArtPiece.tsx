import { useTheme } from '../themes/ThemeProvider';
import type { Theme } from '../themes/theme';
import { cx } from './cx';

// Small art pieces for empty space: the paintings we already have, cropped to a wide band in a
// plain wooden frame. Each spot has one painting per story (Låven = round 2, Gården = round 1).
// Everything is decorative (empty alt), lazy loaded and offered as AVIF with a WebP fallback.

interface Painting {
  /** Folder under /art and file name without the @1x/@2x suffix. */
  dir: 'scenes' | 'home' | 'story';
  name: string;
  /** Pixel width of the @1x file; the @2x file is twice that. */
  width: number;
  /** Which part of the painting stays in view when it is cropped to a band. */
  focus: string;
}

export type ArtSpot = 'home' | 'leaderboard' | 'badges' | 'profile' | 'office';

const PIECES: Record<ArtSpot, Record<Theme, Painting>> = {
  home: {
    laaven: { dir: 'scenes', name: 'R-17-horse', width: 714, focus: '50% 45%' },
    gaarden: { dir: 'scenes', name: 'L-10-barn-night-wide', width: 768, focus: '50% 40%' },
  },
  leaderboard: {
    laaven: { dir: 'scenes', name: 'R-16-ledger', width: 800, focus: '70% 50%' },
    gaarden: { dir: 'story', name: 'L-12-hayloft-feast', width: 600, focus: '50% 55%' },
  },
  badges: {
    laaven: { dir: 'scenes', name: 'R-12-julegrot', width: 583, focus: '50% 70%' },
    gaarden: { dir: 'scenes', name: 'L-15-error-mice', width: 600, focus: '50% 75%' },
  },
  profile: {
    laaven: { dir: 'home', name: 'R-13-stable-sleep', width: 714, focus: '50% 55%' },
    gaarden: { dir: 'home', name: 'L-13-empty-asleep', width: 600, focus: '50% 55%' },
  },
  office: {
    laaven: { dir: 'scenes', name: 'R-16-ledger-b', width: 800, focus: '60% 50%' },
    gaarden: { dir: 'scenes', name: 'L-16-kontor-header-wide', width: 800, focus: '75% 50%' },
  },
};

export function ArtPiece({ spot, className }: { spot: ArtSpot; className?: string }) {
  const { theme } = useTheme();
  const p = PIECES[spot][theme];
  const base = `/art/${p.dir}/${p.name}`;
  const sizes = '(min-width: 768px) 720px, 100vw';
  const set = (ext: string) =>
    `${base}@1x.${ext} ${String(p.width)}w, ${base}@2x.${ext} ${String(p.width * 2)}w`;
  return (
    <figure className={cx('n-art', className)} data-spot={spot}>
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
        <img
          src={`${base}@1x.webp`}
          srcSet={set('webp')}
          sizes={sizes}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ objectPosition: p.focus }}
        />
      </picture>
    </figure>
  );
}
