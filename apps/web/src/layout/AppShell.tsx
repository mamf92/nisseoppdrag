import { Outlet } from 'react-router-dom';
import { AppNav } from '../ui';
import { PLAYER_NAV } from '../ui';
import type { NavItem } from '../ui/AppNav';
import { useAuth } from '../auth/AuthProvider';

const ADMIN_NAV: NavItem = { to: '/kontor', labelKey: 'nav.office', icon: 'key' };

// The signed-in frame: bottom bar below 768 px, left rail from 768 px. Admins get a fifth tab.
export function AppShell() {
  const { state } = useAuth();
  const isAdmin =
    state.status === 'member' && (state.me.role === 'admin' || state.me.isPlatformAdmin);
  return (
    <div className="n-shell">
      <AppNav fixed items={isAdmin ? [...PLAYER_NAV, ADMIN_NAV] : PLAYER_NAV} />
      <div className="n-shell__main">
        <Outlet />
      </div>
    </div>
  );
}
