import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { supabase } from '../lib/supabase';
import { useTheme } from '../themes/ThemeProvider';
import { Button, Sheet, useToast } from '../ui';
import { dismissPushAsk, guideSeen, markGuideSeen, pushAskDismissed } from './flag';
import { InstallGuide } from './InstallGuide';
import { detectPlatform, isMobile } from './platform';
import { enablePush, pushSupported, syncPush } from './push';
import { whenUpdateReady } from './register';
import './pwa.css';

const THEME_COLOR = { gaarden: '#f3ede1', laaven: '#161d2b' } as const;

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => {
      setOnline(true);
    };
    const down = () => {
      setOnline(false);
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/**
 * Everything the experimental PWA adds around the app: the first-visit install guide on phones,
 * the notification question in the installed app, the «new version» bar, the offline note and a
 * theme-coloured status bar. Mounted only when the PWA flag is on.
 */
export default function PwaRoot() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { theme } = useTheme();
  const { state } = useAuth();
  const { pathname } = useLocation();
  const online = useOnline();
  const [info] = useState(() => detectPlatform());
  const member = state.status === 'member';

  const [guideOpen, setGuideOpen] = useState(
    () => isMobile(info.platform) && !guideSeen() && pathname !== '/installer',
  );
  const [askDismissed, setAskDismissed] = useState(() => pushAskDismissed());
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(
    () =>
      whenUpdateReady((apply) => {
        setApplyUpdate(() => apply);
      }),
    [],
  );

  // The browser chrome around the installed app follows the story's colours.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  // Installed app, signed in, never asked: offer notifications once.
  const askOpen =
    member &&
    !askDismissed &&
    info.platform === 'standalone' &&
    pushSupported() &&
    Notification.permission === 'default';

  // Keep this device's subscription and language fresh on the server.
  useEffect(() => {
    if (member && supabase) void syncPush(supabase, lang).catch(() => undefined);
  }, [member, lang]);

  function closeGuide() {
    markGuideSeen();
    setGuideOpen(false);
  }

  function closeAsk() {
    dismissPushAsk();
    setAskDismissed(true);
  }

  return (
    <>
      <Sheet open={guideOpen} onClose={closeGuide} title={t('pwa.guide.title')}>
        <InstallGuide onDone={closeGuide} />
        <p>
          <Button variant="ghost" onClick={closeGuide}>
            {t('pwa.guide.later')}
          </Button>
        </p>
      </Sheet>

      <Sheet open={askOpen && !guideOpen} onClose={closeAsk} title={t('pwa.ask.title')}>
        <div className="n-form">
          <img className="n-ask__art" src="/icons/icon-192.png" alt="" width="96" height="96" />
          <p>{t('pwa.push.lead')}</p>
          <div className="n-row">
            <Button
              onClick={() => {
                if (!supabase) return;
                // straight from the tap: Safari needs the gesture for its prompt
                void enablePush(supabase, lang)
                  .then((status) => {
                    if (status === 'on') toast.show(t('pwa.push.enabled'));
                  })
                  .catch(() => {
                    toast.show(t('pwa.push.error'), 'error');
                  })
                  .finally(closeAsk);
              }}
            >
              {t('pwa.push.enable')}
            </Button>
            <Button variant="ghost" onClick={closeAsk}>
              {t('pwa.guide.later')}
            </Button>
          </div>
        </div>
      </Sheet>

      {applyUpdate || !online ? (
        <div className="n-pwa-bar" role="status">
          {!online ? <span>{t('pwa.offline')}</span> : null}
          {applyUpdate && online ? (
            <>
              <span>{t('pwa.update')}</span>
              <Button variant="dark" onClick={applyUpdate}>
                {t('pwa.update.apply')}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
