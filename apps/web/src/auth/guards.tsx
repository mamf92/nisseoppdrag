import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';

function Loading() {
  const t = useT();
  return (
    <p role="status" className="p-6">
      {t('app.loading')}
    </p>
  );
}

// Signed in and a member of a workplace.
export function RequireMember({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signedOut')
    return <Navigate to="/logg-inn" state={{ from: location.pathname }} replace />;
  if (state.status === 'signedIn') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

// Signed in, but not yet a member: the onboarding page.
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signedOut') return <Navigate to="/logg-inn" replace />;
  if (state.status === 'member') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Workplace admins (and platform admins). The database enforces this too; this only hides pages.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const t = useT();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signedOut') return <Navigate to="/logg-inn" replace />;
  if (state.status === 'signedIn') return <Navigate to="/onboarding" replace />;
  if (state.me.role !== 'admin' && !state.me.isPlatformAdmin) {
    return (
      <p role="alert" className="p-6">
        {t('guard.forbidden')}
      </p>
    );
  }
  return <>{children}</>;
}
