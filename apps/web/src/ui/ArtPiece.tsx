import type { CSSProperties } from 'react';
import { useTheme } from '../themes/ThemeProvider';
import type { Theme } from '../themes/theme';
import { cx } from './cx';

// Small art pieces for empty space: the paintings we already have, shown whole and bled into the
// page like watercolour on damp paper (see .n-art in ui.css). There is no card or frame, and the
// painting is never cropped, so the nisse, the horse and the other subjects stay in view. Each spot
// has one painting per story. Everything is decorative (empty alt), lazy loaded and offered as AVIF
// with a WebP fallback.

interface Painting {
  /** Folder under /art and file name without the @1x/@2x suffix. */
  dir: 'scenes' | 'home' | 'story';
  name: string;
  /** Pixel size of the @1x file; the @2x file is twice that. */
  width: number;
  height: number;
  /** Widest the piece may get, so a tall painting does not fill the screen. */
  maxWidth: string;
  /**
   * Where the subject is, in % of the painting: centre x, centre y, and the half width and height of
   * the part that must stay fully solid. The bleed only starts outside this oval.
   */
  focus: [x: number, y: number, rx: number, ry: number];
  /** How much of each edge bleeds away, in % of the painting: top, right, bottom, left. */
  feather: [top: number, right: number, bottom: number, left: number];
}

export type ArtSpot = 'home' | 'leaderboard' | 'badges' | 'profile' | 'office';

const PIECES: Record<ArtSpot, Record<Theme, Painting>> = {
  home: {
    laaven: {
      dir: 'scenes',
      name: 'R-17-horse',
      width: 714,
      height: 476,
      maxWidth: '34rem',
      focus: [45, 50, 70, 75],
      feather: [6, 8, 8, 6],
    },
    gaarden: {
      dir: 'scenes',
      name: 'L-10-barn-night-wide',
      width: 768,
      height: 320,
      maxWidth: '42rem',
      focus: [62, 50, 70, 80],
      feather: [6, 6, 10, 8],
    },
  },
  leaderboard: {
    laaven: {
      dir: 'scenes',
      name: 'R-16-ledger',
      width: 800,
      height: 400,
      maxWidth: '38rem',
      focus: [62, 55, 62, 75],
      feather: [8, 6, 8, 16],
    },
    gaarden: {
      dir: 'story',
      name: 'L-12-hayloft-feast',
      width: 600,
      height: 450,
      maxWidth: '32rem',
      focus: [50, 50, 70, 72],
      feather: [8, 8, 8, 8],
    },
  },
  badges: {
    laaven: {
      dir: 'scenes',
      name: 'R-12-julegrot',
      width: 583,
      height: 583,
      maxWidth: '24rem',
      focus: [62, 50, 75, 75],
      feather: [6, 6, 10, 8],
    },
    gaarden: {
      dir: 'scenes',
      name: 'L-15-error-mice',
      width: 600,
      height: 450,
      maxWidth: '32rem',
      focus: [55, 70, 70, 55],
      feather: [22, 6, 10, 6],
    },
  },
  profile: {
    laaven: {
      dir: 'home',
      name: 'R-13-stable-sleep',
      width: 714,
      height: 476,
      maxWidth: '34rem',
      focus: [70, 60, 62, 70],
      feather: [8, 6, 10, 10],
    },
    gaarden: {
      dir: 'home',
      name: 'L-13-empty-asleep',
      width: 600,
      height: 450,
      maxWidth: '32rem',
      focus: [45, 62, 62, 65],
      feather: [10, 10, 10, 10],
    },
  },
  office: {
    laaven: {
      dir: 'scenes',
      name: 'R-16-ledger-b',
      width: 800,
      height: 400,
      maxWidth: '38rem',
      focus: [72, 55, 55, 75],
      feather: [8, 6, 6, 22],
    },
    gaarden: {
      dir: 'scenes',
      name: 'L-16-kontor-header-wide',
      width: 800,
      height: 267,
      maxWidth: '42rem',
      focus: [80, 55, 50, 80],
      feather: [6, 6, 6, 25],
    },
  },
};

export function ArtPiece({ spot, className }: { spot: ArtSpot; className?: string }) {
  const { theme } = useTheme();
  const p = PIECES[spot][theme];
  const base = `/art/${p.dir}/${p.name}`;
  const sizes = `(min-width: 768px) ${p.maxWidth}, 100vw`;
  const set = (ext: string) =>
    `${base}@1x.${ext} ${String(p.width)}w, ${base}@2x.${ext} ${String(p.width * 2)}w`;
  const [fx, fy, rx, ry] = p.focus;
  const [ft, fr, fb, fl] = p.feather;
  const style = {
    maxWidth: p.maxWidth,
    aspectRatio: `${String(p.width)} / ${String(p.height)}`,
    '--fx': `${String(fx)}%`,
    '--fy': `${String(fy)}%`,
    '--rx': `${String(rx)}%`,
    '--ry': `${String(ry)}%`,
    '--ft': `${String(ft)}%`,
    '--fr': `${String(100 - fr)}%`,
    '--fb': `${String(100 - fb)}%`,
    '--fl': `${String(fl)}%`,
  } as CSSProperties;
  return (
    <figure className={cx('n-art', className)} data-spot={spot} style={style}>
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
        <img
          src={`${base}@1x.webp`}
          srcSet={set('webp')}
          sizes={sizes}
          alt=""
          loading="lazy"
          decoding="async"
          width={p.width}
          height={p.height}
        />
      </picture>
    </figure>
  );
}
