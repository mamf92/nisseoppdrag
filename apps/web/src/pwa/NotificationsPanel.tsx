import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { supabase } from '../lib/supabase';
import { Button, useToast } from '../ui';
import { disablePush, enablePush, pushStatus, readPrefs, sendTestPush, updatePrefs } from './push';
import type { PushPrefs, PushStatus } from './push';

/** Notification switches for this device: on/off, the two message kinds, and a test. */
export function NotificationsPanel({ onInstallGuide }: { onInstallGuide?: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { state } = useAuth();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = state.status === 'member';

  useEffect(() => {
    let alive = true;
    void pushStatus()
      .catch((): PushStatus => 'unsupported')
      .then(async (next) => {
        const stored =
          next === 'on' && supabase ? await readPrefs(supabase).catch(() => null) : null;
        if (!alive) return;
        setStatus(next);
        setPrefs(stored);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === null) return null;

  async function turnOn() {
    if (!supabase) return;
    setBusy(true);
    try {
      const next = await enablePush(supabase, lang);
      setStatus(next);
      if (next === 'on') {
        setPrefs({ newWeek: true, reminder: true });
        toast.show(t('pwa.push.enabled'));
      }
    } catch {
      toast.show(t('pwa.push.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!supabase) return;
    setBusy(true);
    await disablePush(supabase).catch(() => undefined);
    setBusy(false);
    setPrefs(null);
    setStatus('off');
  }

  async function change(next: PushPrefs) {
    if (!supabase) return;
    const before = prefs;
    setPrefs(next);
    await updatePrefs(supabase, lang, next).catch(() => {
      setPrefs(before);
      toast.show(t('pwa.push.error'), 'error');
    });
  }

  async function test() {
    if (!supabase) return;
    setBusy(true);
    const ok = await sendTestPush(supabase);
    setBusy(false);
    toast.show(t(ok ? 'pwa.push.test_sent' : 'pwa.push.test_held'), ok ? 'info' : 'error');
  }

  return (
    <div className="n-push" data-status={status}>
      <p className="n-page__lead">{t('pwa.push.lead')}</p>
      {status === 'unsupported' ? <p>{t('pwa.push.unsupported')}</p> : null}
      {status === 'denied' ? <p>{t('pwa.push.denied')}</p> : null}
      {status === 'needs-install' ? (
        <>
          <p>{t('pwa.push.needs_install')}</p>
          {onInstallGuide ? <Button onClick={onInstallGuide}>{t('pwa.guide.open')}</Button> : null}
        </>
      ) : null}
      {status === 'off' && !signedIn ? <p>{t('pwa.push.signin')}</p> : null}
      {status === 'off' && signedIn ? (
        <Button disabled={busy} onClick={() => void turnOn()}>
          {t('pwa.push.enable')}
        </Button>
      ) : null}
      {status === 'on' ? (
        <>
          <p className="n-push__on">{t('pwa.push.on')}</p>
          {prefs ? (
            <fieldset className="n-push__prefs">
              <legend className="sr-only">{t('pwa.push.title')}</legend>
              <label>
                <input
                  type="checkbox"
                  checked={prefs.newWeek}
                  onChange={(e) => void change({ ...prefs, newWeek: e.target.checked })}
                />
                {t('pwa.push.new_week')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={prefs.reminder}
                  onChange={(e) => void change({ ...prefs, reminder: e.target.checked })}
                />
                {t('pwa.push.reminder')}
              </label>
            </fieldset>
          ) : null}
          <div className="n-row">
            <Button variant="dark" disabled={busy} onClick={() => void test()}>
              {t('pwa.push.test')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void turnOff()}>
              {t('pwa.push.disable')}
            </Button>
          </div>
        </>
      ) : null}
      <p className="n-push__privacy">{t('pwa.push.privacy')}</p>
    </div>
  );
}
