import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../ui';
import { useT } from '../i18n/I18nProvider';
import { useAuth } from './AuthProvider';
import { firstStepFor, readIntent } from './intent';

function Loading() {
  const t = useT();
  return (
    <p role="status" className="p-6">
      {t('app.loading')}
    </p>
  );
}

function LoadFailed() {
  const t = useT();
  const { retry } = useAuth();
  return (
    <div role="alert" className="grid justify-items-start gap-3 p-6">
      <p>{t('error.load')}</p>
      <Button
        variant="ghost"
        onClick={() => {
          void retry();
        }}
      >
        {t('error.retry')}
      </Button>
    </div>
  );
}

// Signed in and a member of a workplace.
export function RequireMember({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <LoadFailed />;
  // The front page is the welcome page; a deep link goes straight to sign-in and back again.
  if (state.status === 'signedOut')
    return location.pathname === '/' ? (
      <Navigate to="/velkommen" replace />
    ) : (
      <Navigate to="/logg-inn" state={{ from: location.pathname }} replace />
    );
  if (state.status === 'signedIn') return <Navigate to={firstStepFor(readIntent())} replace />;
  return <>{children}</>;
}

// Signed in, but not yet a member: the onboarding page.
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <LoadFailed />;
  if (state.status === 'signedOut') return <Navigate to="/logg-inn" replace />;
  if (state.status === 'member') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Workplace admins (and platform admins). The database enforces this too; this only hides pages.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <LoadFailed />;
  if (state.status === 'signedOut') return <Navigate to="/logg-inn" replace />;
  if (state.status === 'signedIn') return <Navigate to="/onboarding" replace />;
  // A player who types /kontor lands back on their own home.
  if (state.me.role !== 'admin' && !state.me.isPlatformAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
