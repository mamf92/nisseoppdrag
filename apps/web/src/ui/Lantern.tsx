import { useCallback, useRef } from 'react';
import { useBoop } from '../fun/motion';
import { letItSnow } from '../fun/Snowfall';
import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';

const TOTAL = 5;
const SNOW_TAPS = 3;
const TAP_WINDOW_MS = 1200;

// One pane lights per completed mission. Tapping the lantern makes it flicker; three quick taps
// shake snow off it, all over the app.
export function Lantern({ done }: { done: number }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);
  const onTap = useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < TAP_WINDOW_MS), now];
    if (taps.current.length >= SNOW_TAPS) {
      taps.current = [];
      letItSnow();
    }
  }, []);
  useBoop(ref, 'n-flicker', onTap);
  const lit = Math.max(0, Math.min(TOTAL, done));
  const label = t('lantern.progress', { done: lit, total: TOTAL });
  return (
    <div ref={ref} className="n-lantern" role="img" aria-label={label}>
      <div className="n-panes" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <i key={i} className={cx('n-pane', i < lit && 'n-pane--lit')} />
        ))}
      </div>
      <small aria-hidden="true">{label}</small>
    </div>
  );
}
