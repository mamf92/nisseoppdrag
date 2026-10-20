import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';

const TOTAL = 5;

// One pane lights per completed mission.
export function Lantern({ done }: { done: number }) {
  const t = useT();
  const lit = Math.max(0, Math.min(TOTAL, done));
  const label = t('lantern.progress', { done: lit, total: TOTAL });
  return (
    <div className="n-lantern" role="img" aria-label={label}>
      <div className="n-panes" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <i key={i} className={cx('n-pane', i < lit && 'n-pane--lit')} />
        ))}
      </div>
      <small aria-hidden="true">{label}</small>
    </div>
  );
}
