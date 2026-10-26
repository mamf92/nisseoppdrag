import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { useAuth } from '../auth/AuthProvider';
import { firstStepFor, readIntent, storeIntent } from '../auth/intent';
import type { Intent } from '../auth/intent';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../ui';

// The front door. Joining a game and making one use the same sign-in; what the visitor came to
// do is chosen first, so the sign-in knows where to go afterwards.
export function WelcomePage() {
  const t = useT();
  const navigate = useNavigate();
  const { state } = useAuth();

  if (state.status === 'member') return <Navigate to="/" replace />;
  if (state.status === 'signedIn') return <Navigate to={firstStepFor(readIntent())} replace />;

  function choose(intent: Intent) {
    storeIntent(intent);
    void navigate('/logg-inn');
  }

  return (
    <AuthLayout title={t('welcome.title')} lead={t('welcome.lead')}>
      <div className="grid gap-3">
        <Button
          onClick={() => {
            choose('join');
          }}
        >
          {t('welcome.join')}
        </Button>
        <p className="m-0 text-sm">{t('welcome.join.hint')}</p>
        <Button
          variant="dark"
          onClick={() => {
            choose('create');
          }}
        >
          {t('welcome.create')}
        </Button>
        <p className="m-0 text-sm">{t('welcome.create.hint')}</p>
        <Button
          variant="ghost"
          onClick={() => {
            void navigate('/logg-inn');
          }}
        >
          {t('welcome.returning')}
        </Button>
      </div>
    </AuthLayout>
  );
}
