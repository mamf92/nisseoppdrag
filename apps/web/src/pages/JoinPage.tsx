import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { storeIntent } from '../auth/intent';
import { storeInvite } from '../auth/invite';
import { useT } from '../i18n/I18nProvider';

// The landing page of an invite link: keep the code, then sign in (if needed) and onboard.
export function JoinPage() {
  const { code } = useParams();
  const { state } = useAuth();
  const t = useT();

  useEffect(() => {
    if (code) {
      storeInvite(code);
      storeIntent('join');
    }
  }, [code]);

  if (state.status === 'loading')
    return (
      <p role="status" className="p-6">
        {t('app.loading')}
      </p>
    );
  if (state.status === 'member') return <Navigate to="/" replace />;
  return <Navigate to={state.status === 'signedIn' ? '/onboarding' : '/logg-inn'} replace />;
}
