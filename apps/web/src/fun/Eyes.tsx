import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../themes/ThemeProvider';

// Where the eyes may peek from: the dark corners, clear of the bottom bar and the rail.
const SPOTS = [
  { left: '6px', top: '22%' },
  { right: '6px', top: '34%' },
  { right: '10px', top: '62%' },
  { left: '12px', top: '70%' },
] as const;

const SHOWN_MS = 7000;

/** The chance that the nisse is watching on a page: much higher in the small hours. */
export function eyesChance(hour: number): number {
  return hour >= 22 || hour < 5 ? 0.5 : 0.15;
}

// Låven only: now and then, after a while on a page, a pair of eyes glints in the dark at the
// edge of the screen, blinks, and is gone. Touch them and they vanish at once. Purely decorative.
export function Eyes() {
  const { theme } = useTheme();
  const { pathname } = useLocation();
  // The spot is tied to the page it was chosen on, so moving on hides the eyes at once.
  const [peek, setPeek] = useState<{ spot: number; path: string; gone: boolean } | null>(null);

  useEffect(() => {
    if (theme !== 'laaven' || Math.random() > eyesChance(new Date().getHours())) return;
    let hide = 0;
    const show = window.setTimeout(
      () => {
        setPeek({ spot: Math.floor(Math.random() * SPOTS.length), path: pathname, gone: false });
        hide = window.setTimeout(() => {
          setPeek(null);
        }, SHOWN_MS);
      },
      12_000 + Math.random() * 25_000,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [theme, pathname]);

  if (!peek || peek.path !== pathname || theme !== 'laaven') return null;
  return (
    <div
      className={peek.gone ? 'n-eyes n-eyes--gone' : 'n-eyes'}
      style={SPOTS[peek.spot]}
      aria-hidden="true"
      onPointerDown={() => {
        setPeek({ ...peek, gone: true });
      }}
      onAnimationEnd={(event) => {
        if (event.animationName === 'n-eyes-gone') setPeek(null);
      }}
    >
      <i />
      <i />
    </div>
  );
}
