import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth/AuthLayout';
import { useAuth } from '../auth/AuthProvider';
import { errorKey, isEmail } from '../auth/errors';
import { firstStepFor, readIntent } from '../auth/intent';
import { useT } from '../i18n/I18nProvider';
import { Button, TextField } from '../ui';

// Two steps: the e-mail address, then the six-digit code that was sent to it.
export function LoginPage() {
  const t = useT();
  const { state, sendCode, verifyCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | undefined>();
  const [intent] = useState(() => readIntent());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'member') {
      const from = (location.state as { from?: string } | null)?.from;
      void navigate(from ?? '/', { replace: true });
    } else if (state.status === 'signedIn') {
      void navigate(firstStepFor(readIntent()), { replace: true });
    }
  }, [state, navigate, location.state]);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) {
      setError(t('error.invalid_email'));
      return;
    }
    setBusy(true);
    setError(undefined);
    const failure = await sendCode(email);
    setBusy(false);
    if (failure) setError(t(errorKey(failure)));
    else setStep('code');
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const failure = await verifyCode(email, code);
    setBusy(false);
    if (failure) setError(t('error.code_invalid'));
  }

  if (step === 'email') {
    return (
      <AuthLayout title={t(`auth.login.title.${intent ?? 'none'}`)} lead={t('auth.login.lead')}>
        <form className="grid gap-4" onSubmit={(e) => void submitEmail(e)} noValidate>
          <TextField
            label={t('auth.email.label')}
            hint={t('auth.email.hint')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            error={error}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <Button type="submit" disabled={busy}>
            {t('auth.email.send')}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.code.title')} lead={t('auth.code.lead', { email: email.trim() })}>
      <form className="grid gap-4" onSubmit={(e) => void submitCode(e)} noValidate>
        <TextField
          label={t('auth.code.label')}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          error={error}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ''));
          }}
        />
        <Button type="submit" disabled={busy || code.length !== 6}>
          {t('auth.code.submit')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setStep('email');
            setCode('');
            setError(undefined);
          }}
        >
          {t('auth.code.other')}
        </Button>
      </form>
    </AuthLayout>
  );
}
