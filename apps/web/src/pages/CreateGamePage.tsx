import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { useAuth } from '../auth/AuthProvider';
import { storeIntent } from '../auth/intent';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../ui';

// A new account that came to make a game. Making one yourself is not open yet (a game is set up
// by the platform admins today, who hand out the first admin code), so this says so and offers
// the way in that works: join with a code.
export function CreateGamePage() {
  const t = useT();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <AuthLayout title={t('create.title')} lead={t('create.lead')}>
      <div className="grid gap-4">
        <p className="m-0">{t('create.how')}</p>
        <Button
          onClick={() => {
            storeIntent('join');
            void navigate('/onboarding');
          }}
        >
          {t('create.haveCode')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void signOut().then(() => navigate('/velkommen', { replace: true }));
          }}
        >
          {t('auth.signout')}
        </Button>
      </div>
    </AuthLayout>
  );
}
