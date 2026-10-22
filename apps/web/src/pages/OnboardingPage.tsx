import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { useAuth } from '../auth/AuthProvider';
import { errorKey } from '../auth/errors';
import { clearInvite, readInvite } from '../auth/invite';
import {
  BEARD_COLOURS,
  CAP_COLOURS,
  generateCharacterName,
  isValidNisseName,
  NAME_MAX,
} from '../auth/nisseName';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { THEMES } from '../themes/theme';
import type { Theme } from '../themes/theme';
import { useTheme } from '../themes/ThemeProvider';
import { Button, NisseAvatar, TextField } from '../ui';

const CAP_LABELS: readonly MessageKey[] = [
  'colour.red',
  'colour.green',
  'colour.blue',
  'colour.purple',
  'colour.orange',
];
const BEARD_LABELS: readonly MessageKey[] = [
  'colour.white',
  'colour.grey',
  'colour.blond',
  'colour.brown',
  'colour.dark',
];

function Swatches({
  legend,
  colours,
  labels,
  value,
  onChange,
}: {
  legend: string;
  colours: readonly string[];
  labels: readonly MessageKey[];
  value: string;
  onChange: (colour: string) => void;
}) {
  const t = useT();
  return (
    <fieldset className="grid gap-2">
      <legend className="font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {colours.map((colour, index) => {
          const label = t(labels[index] ?? 'colour.red');
          return (
            <label key={colour} className="n-swatch">
              <input
                type="radio"
                name={legend}
                value={colour}
                checked={value === colour}
                onChange={() => {
                  onChange(colour);
                }}
              />
              <span style={{ background: colour }} aria-hidden="true" />
              <span className="sr-only">{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const STORY_ART: Record<Theme, string> = {
  gaarden: '/art/story/L-12-hayloft-feast',
  laaven: '/art/story/R-10-keeping-watch',
};

type Step = 'code' | 'story' | 'name';

function StoryCards({ value, onChange }: { value: Theme; onChange: (story: Theme) => void }) {
  const t = useT();
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t('onboard.story.legend')}</legend>
      {THEMES.map((story) => {
        const base = STORY_ART[story];
        return (
          <label key={story} className="n-story">
            <input
              type="radio"
              name="story"
              value={story}
              checked={value === story}
              onChange={() => {
                onChange(story);
              }}
            />
            <picture>
              <source type="image/avif" srcSet={`${base}@1x.avif 1x, ${base}@2x.avif 2x`} />
              <img
                src={`${base}@1x.webp`}
                srcSet={`${base}@1x.webp 1x, ${base}@2x.webp 2x`}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </picture>
            <strong className="n-story__title">{t(`story.${story}.title`)}</strong>
            <span className="n-story__pitch">{t(`story.${story}.pitch`)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function OnboardingPage() {
  const t = useT();
  const { redeemInvite, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [storedCode, setStoredCode] = useState(() => readInvite());
  const [code, setCode] = useState(storedCode ?? '');
  // A code from the invite link skips the first step.
  const [step, setStep] = useState<Step>(storedCode ? 'story' : 'code');
  const [name, setName] = useState(() => generateCharacterName(theme));
  const [nameEdited, setNameEdited] = useState(false);
  const [cap, setCap] = useState<string>(CAP_COLOURS[0]);
  const [beard, setBeard] = useState<string>(BEARD_COLOURS[0]);
  const [errors, setErrors] = useState<{ code?: string; name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  function chooseStory(story: Theme) {
    setTheme(story);
    if (!nameEdited) setName(generateCharacterName(story));
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
    if (!isValidNisseName(name)) {
      setErrors({ name: t('error.name_length', { max: NAME_MAX }) });
      return;
    }
    setErrors({});
    setBusy(true);
    const failure = await redeemInvite(code, name, { cap, beard });
    setBusy(false);
    if (!failure) {
      clearInvite();
      void navigate('/', { replace: true });
      return;
    }
    const key = errorKey(failure);
    if (key === 'error.name_taken') setErrors({ name: t(key) });
    else if (key === 'error.invite_invalid' || key === 'error.domain_not_allowed') {
      // The code is wrong: back to the code step, where it can be replaced.
      if (storedCode) {
        clearInvite();
        setStoredCode(null);
      }
      setErrors({ code: t(key) });
      setStep('code');
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
      <AuthLayout title={t('onboard.story.title')} lead={t('onboard.story.lead')}>
        <div className="grid gap-4">
          <StoryCards value={theme} onChange={chooseStory} />
          <p className="m-0 text-sm">{t('onboard.story.note')}</p>
          <Button
            onClick={() => {
              setStep('name');
            }}
          >
            {t('onboard.next')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep('code');
            }}
          >
            {t('onboard.back')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t(`onboard.name.title.${theme}`)} lead={t(`onboard.name.lead.${theme}`)}>
      <form className="grid gap-5" onSubmit={(e) => void submit(e)} noValidate>
        <div className="flex items-center gap-4">
          <NisseAvatar look={{ cap, beard }} size={72} />
          <div className="grid flex-1 gap-2">
            <TextField
              label={t(`onboard.name.label.${theme}`)}
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
                setName(generateCharacterName(theme));
                setNameEdited(false);
              }}
            >
              {t('onboard.name.random')}
            </Button>
          </div>
        </div>
        <Swatches
          legend={t('onboard.cap')}
          colours={CAP_COLOURS}
          labels={CAP_LABELS}
          value={cap}
          onChange={setCap}
        />
        <Swatches
          legend={t('onboard.beard')}
          colours={BEARD_COLOURS}
          labels={BEARD_LABELS}
          value={beard}
          onChange={setBeard}
        />
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
