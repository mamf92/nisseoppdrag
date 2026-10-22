import type { ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function Chip({
  icon,
  spent,
  children,
}: {
  icon?: IconName;
  spent?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cx('n-chip', spent && 'n-chip--spent')}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

// Shows how many skips or rerolls the week still has. `left` is 0 once it is used.
export function TokenChip({ kind, left }: { kind: 'skip' | 'reroll'; left: number }) {
  const t = useT();
  const spent = left <= 0;
  const label =
    kind === 'skip'
      ? spent
        ? t('token.skip.spent')
        : t('token.skip.left', { n: left })
      : spent
        ? t('token.reroll.spent')
        : t('token.reroll.left', { n: left });
  return (
    <Chip icon={kind === 'skip' ? 'skip' : 'sack'} spent={spent}>
      {label}
    </Chip>
  );
}
