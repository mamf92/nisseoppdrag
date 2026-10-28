import { useRef } from 'react';
import { useBoop } from '../fun/motion';
import { useSnowTaps } from '../fun/Snowfall';
import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';

const TOTAL = 5;

// One pane lights per completed mission. Tapping the lantern makes it flicker; three quick taps
// shake snow off it, all over the app.
export function Lantern({ done }: { done: number }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const onTap = useSnowTaps();
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
