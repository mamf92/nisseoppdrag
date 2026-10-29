import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { useAuth } from '../auth/AuthProvider';
import { storeIntent } from '../auth/intent';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../ui';
import { OnboardingPage } from './OnboardingPage';

// A new account that came to make a game. Anyone can, within the limits the database keeps (a
// number of games in all, and a few per person). The page asks first, so nobody fills in a form
// for a game that cannot be made; if the answer cannot be had, the form still opens and the
// database decides.
export function CreateGamePage() {
  const t = useT();
  const navigate = useNavigate();
  const { canCreateGame, signOut } = useAuth();
  const [room, setRoom] = useState<'checking' | 'ok' | 'full' | 'limit'>('checking');

  useEffect(() => {
    let active = true;
    void canCreateGame().then((result) => {
      if (active) setRoom('error' in result ? 'ok' : result.state);
    });
    return () => {
      active = false;
    };
  }, [canCreateGame]);

  if (room === 'checking')
    return (
      <p role="status" className="p-6">
        {t('app.loading')}
      </p>
    );
  if (room === 'ok') return <OnboardingPage mode="create" />;

  return (
    <AuthLayout title={t(`create.${room}.title`)} lead={t(`create.${room}.lead`)}>
      <div className="grid gap-4">
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
