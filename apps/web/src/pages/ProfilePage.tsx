import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Story } from '../auth/AuthProvider';
import { errorKey } from '../auth/errors';
import { farmerName, randomFarmer } from '../auth/farmerName';
import type { FarmerChoice } from '../auth/farmerName';
import { generateNisseName, isValidNisseName, NAME_MAX } from '../auth/nisseName';
import { gameErrorKey } from '../game/errors';
import { useT } from '../i18n/I18nProvider';
import { useTheme } from '../themes/ThemeProvider';
import { Button, LanguageSwitch, Sheet, TextField, useToast } from '../ui';
import { FarmerNamePicker } from './FarmerNamePicker';

const STORIES: readonly Story[] = ['gaarden', 'laaven'];
const NO_NAMES: ReadonlySet<string> = new Set();

function NameSheet({
  story,
  onClose,
  onSubmit,
}: {
  story: Story | null;
  onClose: () => void;
  onSubmit: (story: Story, name: string) => Promise<string | null>;
}) {
  const t = useT();
  const [name, setName] = useState(() => generateNisseName());
  const [farmer, setFarmer] = useState<FarmerChoice | null>(() => randomFarmer(NO_NAMES));
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  if (!story) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!story) return;
    const chosen = story === 'laaven' && farmer ? farmerName(farmer) : name;
    if (!isValidNisseName(chosen)) {
      setError(t('error.name_length', { max: NAME_MAX }));
      return;
    }
    setBusy(true);
    const failure = await onSubmit(story, chosen);
    setBusy(false);
    if (failure) {
      setError(failure);
      // Taken by someone in the meantime: offer another one.
      setName(generateNisseName());
      setFarmer(randomFarmer(NO_NAMES));
    }
  }

  return (
    <form className="n-form" onSubmit={(e) => void submit(e)} noValidate>
      <p>{t(`onboard.name.lead.${story}`)}</p>
      {story === 'laaven' && farmer ? (
        <FarmerNamePicker value={farmer} taken={NO_NAMES} onChange={setFarmer} error={error} />
      ) : (
        <div className="grid gap-2">
          <TextField
            label={t('onboard.name.label.gaarden')}
            hint={t('onboard.name.hint')}
            maxLength={NAME_MAX}
            autoComplete="off"
            value={name}
            error={error}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setName(generateNisseName());
            }}
          >
            {t('onboard.name.random')}
          </Button>
        </div>
      )}
      <div className="n-row">
        <Button type="submit" disabled={busy}>
          {t('profile.story.confirm')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { state, signOut, updateProfile, deleteAccount } = useAuth();
  const { setTheme } = useTheme();
  const [naming, setNaming] = useState<Story | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  if (state.status !== 'member') return null;
  const { me } = state;
  const word = t('profile.delete.word');

  // Changing story keeps the points and badges; a story with no name yet asks for one first.
  async function switchTo(story: Story, name?: string): Promise<string | null> {
    const failure = await updateProfile(story, name);
    if (failure) {
      const key = errorKey(failure);
      toast.show(t(key), 'error');
      return t(key);
    }
    setTheme(story);
    setNaming(null);
    return null;
  }

  function pick(story: Story) {
    if (story === me.story) return;
    const hasName = story === 'gaarden' ? me.nisseName !== null : me.farmerName !== null;
    if (hasName) void switchTo(story);
    else setNaming(story);
  }

  async function confirmDelete(event: FormEvent) {
    event.preventDefault();
    if (typed.trim().toLowerCase() !== word.toLowerCase()) return;
    setDeleteBusy(true);
    const failure = await deleteAccount();
    setDeleteBusy(false);
    if (failure) {
      toast.show(
        t(failure.message === 'last_admin' ? 'profile.delete.last_admin' : gameErrorKey(failure)),
        'error',
      );
      return;
    }
    toast.show(t('profile.delete.done'));
    void navigate('/logg-inn', { replace: true });
  }

  return (
    <main className="n-page">
      <header>
        <h1>{me.name}</h1>
        <p className="n-page__lead">
          {me.workplaceName} ·{' '}
          {t(me.role === 'admin' ? 'profile.role.admin' : 'profile.role.player')}
        </p>
      </header>

      <section aria-labelledby="story-h">
        <h2 id="story-h">{t('onboard.story.legend')}</h2>
        <p className="n-page__lead">{t('profile.story.note')}</p>
        <div className="n-segmented" role="group" aria-label={t('onboard.story.legend')}>
          {STORIES.map((story) => (
            <button
              key={story}
              type="button"
              aria-pressed={me.story === story}
              onClick={() => {
                pick(story);
              }}
            >
              {t(`story.${story}.title`)}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h">{t('language.label')}</h2>
        <LanguageSwitch />
      </section>

      <section className="n-row">
        <Button
          variant="ghost"
          onClick={() => {
            void signOut().then(() => navigate('/logg-inn', { replace: true }));
          }}
        >
          {t('auth.signout')}
        </Button>
        <Link to="/personvern">{t('privacy.link')}</Link>
      </section>

      <section className="n-danger" aria-labelledby="delete-h">
        <h2 id="delete-h">{t('profile.delete.title')}</h2>
        <p>{t('profile.delete.lead')}</p>
        <Button
          variant="dark"
          onClick={() => {
            setTyped('');
            setDeleting(true);
          }}
        >
          {t('profile.delete.open')}
        </Button>
      </section>

      <Sheet
        open={naming !== null}
        onClose={() => {
          setNaming(null);
        }}
        title={naming ? t(`onboard.name.title.${naming}`) : ''}
      >
        <NameSheet
          story={naming}
          onClose={() => {
            setNaming(null);
          }}
          onSubmit={(story, name) => switchTo(story, name)}
        />
      </Sheet>

      <Sheet
        open={deleting}
        onClose={() => {
          setDeleting(false);
        }}
        title={t('profile.delete.title')}
      >
        <form className="n-form" onSubmit={(e) => void confirmDelete(e)} noValidate>
          <p>{t('profile.delete.what')}</p>
          <TextField
            label={t('profile.delete.type', { word })}
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
          />
          <div className="n-row">
            <Button
              type="submit"
              variant="dark"
              disabled={deleteBusy || typed.trim().toLowerCase() !== word.toLowerCase()}
            >
              {t('profile.delete.confirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleting(false);
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Sheet>
    </main>
  );
}
