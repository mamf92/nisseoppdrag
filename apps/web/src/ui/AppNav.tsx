import { NavLink } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { MessageKey } from '../i18n/messages';

export interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: IconName;
}

export const PLAYER_NAV: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.missions', icon: 'home' },
  { to: '/toppliste', labelKey: 'nav.leaderboard', icon: 'trophy' },
  { to: '/merker', labelKey: 'nav.badges', icon: 'medal' },
  { to: '/meg', labelKey: 'nav.me', icon: 'cap' },
];

// Bottom tab bar on phones, left rail from 768 px (see ui.css). `fixed` pins it to the viewport;
// without it the bar sits in the flow, which is what the /dev/ui page uses.
export function AppNav({
  items = PLAYER_NAV,
  fixed,
}: {
  items?: readonly NavItem[];
  fixed?: boolean;
}) {
  const t = useT();
  return (
    <nav className={cx('n-nav', fixed && 'n-nav--fixed')} aria-label={t('nav.label')}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'}>
          <Icon name={item.icon} />
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
