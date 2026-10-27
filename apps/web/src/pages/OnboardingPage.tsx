import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { useAuth } from '../auth/AuthProvider';
import { errorKey } from '../auth/errors';
import { clearInvite, readInvite } from '../auth/invite';
import { farmerName, isFree, randomFarmer, settle } from '../auth/farmerName';
import type { FarmerChoice, TakenNames } from '../auth/farmerName';
import { clearIntent } from '../auth/intent';
import { generateFreeNisseName, isValidNisseName, NAME_MAX } from '../auth/nisseName';
import { useT } from '../i18n/I18nProvider';
import type { Theme } from '../themes/theme';
import { useTheme } from '../themes/ThemeProvider';
import { Button, TextField } from '../ui';
import { FarmerNamePicker } from './FarmerNamePicker';
import { StoryStep } from './StoryStep';

type Step = 'code' | 'story' | 'name';

export function OnboardingPage() {
  const t = useT();
  const { redeemInvite, signOut, takenNames } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [storedCode, setStoredCode] = useState(() => readInvite());
  const [code, setCode] = useState(storedCode ?? '');
  // A code from the invite link skips the first step.
  const [step, setStep] = useState<Step>(storedCode ? 'story' : 'code');
  const [taken, setTaken] = useState<TakenNames>(() => new Set());
  const [name, setName] = useState('');
  const [farmer, setFarmer] = useState<FarmerChoice | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  function chooseStory(story: Theme) {
    setTheme(story);
  }

  // Looks up which names are free in the group, then suggests one. If the code is refused the
  // lookup says so, and the player is sent back to the code step.
  async function refreshNames(): Promise<boolean> {
    setBusy(true);
    const result = await takenNames(code);
    setBusy(false);
    let names = new Set<string>();
    if ('error' in result) {
      const key = errorKey(result.error);
      if (key === 'error.invite_invalid' || key === 'error.domain_not_allowed') {
        backToCode(t(key));
        return false;
      }
      // Anything else: carry on with an empty list. The database refuses a taken name anyway.
    } else names = result.names;
    setTaken(names);
    setFarmer((current) => (current ? settle(current, names) : randomFarmer(names)));
    setName((current) =>
      nameEdited && isFree(current, names) ? current : generateFreeNisseName(names),
    );
    return true;
  }

  function backToCode(message: string) {
    if (storedCode) {
      clearInvite();
      setStoredCode(null);
    }
    setErrors({ code: message });
    setStep('code');
  }

  async function toNameStep() {
    if (await refreshNames()) setStep('name');
  }

  function nextFromCode(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setErrors({ code: t('error.invite_invalid') });
      return;
    }
    setErrors({});
    setStep('story');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const chosen = theme === 'laaven' && farmer ? farmerName(farmer) : name;
    if (!isValidNisseName(chosen)) {
      setErrors({ name: t('error.name_length', { max: NAME_MAX }) });
      return;
    }
    if (!isFree(chosen, taken)) {
      setErrors({ name: t('error.name_taken') });
      return;
    }
    setErrors({});
    setBusy(true);
    const failure = await redeemInvite(code, theme, chosen);
    setBusy(false);
    if (!failure) {
      clearInvite();
      clearIntent();
      void navigate('/', { replace: true });
      return;
    }
    const key = errorKey(failure);
    if (key === 'error.name_taken') {
      // Someone took it a moment ago: fetch the list again, move to a free name and say so.
      await refreshNames();
      setErrors({ name: t(key) });
    } else if (key === 'error.invite_invalid' || key === 'error.domain_not_allowed') {
      // The code is wrong: back to the code step, where it can be replaced.
      backToCode(t(key));
    } else setErrors({ form: t(key) });
  }

  const signOutButton = (
    <Button
      variant="ghost"
      onClick={() => {
        void signOut().then(() => navigate('/logg-inn', { replace: true }));
      }}
    >
      {t('auth.signout')}
    </Button>
  );

  if (step === 'code') {
    return (
      <AuthLayout title={t('onboard.code.title')} lead={t('onboard.code.lead')}>
        <form className="grid gap-4" onSubmit={nextFromCode} noValidate>
          <TextField
            label={t('onboard.code.label')}
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            error={errors.code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
          />
          <Button type="submit">{t('onboard.next')}</Button>
          {signOutButton}
        </form>
      </AuthLayout>
    );
  }

  if (step === 'story') {
    return (
      <StoryStep
        value={theme}
        onChange={chooseStory}
        onNext={() => void toNameStep()}
        onBack={() => {
          setStep('code');
        }}
      />
    );
  }

  return (
    <AuthLayout title={t(`onboard.name.title.${theme}`)} lead={t(`onboard.name.lead.${theme}`)}>
      <form className="grid gap-5" onSubmit={(e) => void submit(e)} noValidate>
        {theme === 'laaven' && farmer ? (
          <FarmerNamePicker value={farmer} taken={taken} onChange={setFarmer} error={errors.name} />
        ) : (
          <div className="grid gap-2">
            <TextField
              label={t('onboard.name.label.gaarden')}
              hint={t('onboard.name.hint')}
              maxLength={NAME_MAX}
              autoComplete="off"
              value={name}
              error={errors.name}
              onChange={(e) => {
                setName(e.target.value);
                setNameEdited(true);
              }}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setName(generateFreeNisseName(taken));
                setNameEdited(false);
              }}
            >
              {t('onboard.name.random')}
            </Button>
          </div>
        )}
        {errors.form ? <p role="alert">{errors.form}</p> : null}
        <Button type="submit" disabled={busy}>
          {t('onboard.submit')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setStep('story');
          }}
        >
          {t('onboard.back')}
        </Button>
      </form>
    </AuthLayout>
  );
}
