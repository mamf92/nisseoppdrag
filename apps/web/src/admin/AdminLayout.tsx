import { NavLink, Outlet } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

const TABS: readonly { to: string; label: MessageKey; end?: boolean }[] = [
  { to: '/kontor', label: 'admin.tab.overview', end: true },
  { to: '/kontor/oppdrag', label: 'admin.tab.missions' },
  { to: '/kontor/sesong', label: 'admin.tab.season' },
  { to: '/kontor/nisser', label: 'admin.tab.members' },
  { to: '/kontor/poeng', label: 'admin.tab.points' },
  { to: '/kontor/logg', label: 'admin.tab.log' },
];

// Nissefars kontor: the admin frame inside the player shell. The database checks every action;
// the guard in App.tsx only keeps the pages from showing to people who cannot use them.
export function AdminLayout() {
  const t = useT();
  return (
    <main className="n-page">
      <header>
        <h1>{t('admin.title')}</h1>
        <p className="n-page__lead">{t('admin.lead')}</p>
      </header>
      <nav aria-label={t('admin.nav')}>
        <ul className="n-tabs">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink to={tab.to} end={tab.end}>
                {t(tab.label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </main>
  );
}
