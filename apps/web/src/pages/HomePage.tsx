import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../ui';

// A stand-in until the player home (WP6) arrives: it shows who is signed in and where.
export function HomePage() {
  const t = useT();
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  if (state.status !== 'member') return null;
  const { me } = state;
  return (
    <main className="mx-auto grid max-w-xl gap-4 p-6">
      <h1 className="text-3xl font-bold">{t('app.name')}</h1>
      <div>
        <p className="text-xl font-semibold">{t('home.welcome', { name: me.name })}</p>
        <p>{me.workplaceName}</p>
      </div>
      <p>{t('home.placeholder')}</p>
      <Button
        variant="ghost"
        onClick={() => {
          void signOut().then(() => navigate('/logg-inn', { replace: true }));
        }}
      >
        {t('auth.signout')}
      </Button>
    </main>
  );
}
