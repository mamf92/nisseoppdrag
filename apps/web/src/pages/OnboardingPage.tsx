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
  generateNisseName,
  isValidNisseName,
  NAME_MAX,
} from '../auth/nisseName';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
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

export function OnboardingPage() {
  const t = useT();
  const { redeemInvite, signOut } = useAuth();
  const navigate = useNavigate();
  const [storedCode] = useState(() => readInvite());
  const [code, setCode] = useState(storedCode ?? '');
  const [name, setName] = useState(() => generateNisseName());
  const [cap, setCap] = useState<string>(CAP_COLOURS[0]);
  const [beard, setBeard] = useState<string>(BEARD_COLOURS[0]);
  const [errors, setErrors] = useState<{ code?: string; name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!code.trim()) next.code = t('error.invite_invalid');
    if (!isValidNisseName(name)) next.name = t('error.name_length', { max: NAME_MAX });
    setErrors(next);
    if (next.code ?? next.name) return;

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
    else if (key === 'error.invite_invalid' || key === 'error.domain_not_allowed')
      setErrors({ code: t(key) });
    else setErrors({ form: t(key) });
  }

  return (
    <AuthLayout title={t('onboard.title')} lead={t('onboard.lead')}>
      <form className="grid gap-5" onSubmit={(e) => void submit(e)} noValidate>
        {storedCode ? null : (
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
        )}
        {storedCode && errors.code ? <p role="alert">{errors.code}</p> : null}
        <div className="flex items-center gap-4">
          <NisseAvatar look={{ cap, beard }} size={72} />
          <div className="grid flex-1 gap-2">
            <TextField
              label={t('onboard.name.label')}
              hint={t('onboard.name.hint')}
              maxLength={NAME_MAX}
              autoComplete="off"
              value={name}
              error={errors.name}
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
            void signOut().then(() => navigate('/logg-inn', { replace: true }));
          }}
        >
          {t('auth.signout')}
        </Button>
      </form>
    </AuthLayout>
  );
}
