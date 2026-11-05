import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { Button, useToast } from '../ui';
import { cx } from '../ui/cx';
import { useInstallPrompt } from './installPrompt';
import { NotificationsPanel } from './NotificationsPanel';
import { detectPlatform } from './platform';
import type { PlatformInfo } from './platform';

// ---------- little drawings of the screens the visitor will see ----------

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="n-glyph">
      <path d="M8 9H6v11h12V9h-2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v11M8 6.5 12 3l4 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function MoreGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="n-glyph">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function AddGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="n-glyph">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function DotsGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="n-glyph">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}

function Phone({ children, tall = false }: { children: ReactNode; tall?: boolean }) {
  return (
    <div className={cx('n-phone', tall && 'n-phone--tall')} aria-hidden="true">
      <div className="n-phone__screen">{children}</div>
    </div>
  );
}

function SafariBar({ modern, highlight }: { modern: boolean; highlight: 'share' | 'more' }) {
  return (
    <div className="n-phone__bar">
      {modern ? (
        <>
          <span className="n-phone__url">nisseoppdrag.no</span>
          <span className={cx('n-phone__btn', highlight === 'more' && 'is-hot')}>
            <MoreGlyph />
          </span>
        </>
      ) : (
        <>
          <span className="n-phone__btn">‹</span>
          <span className="n-phone__btn">›</span>
          <span className={cx('n-phone__btn', highlight === 'share' && 'is-hot')}>
            <ShareGlyph />
          </span>
          <span className="n-phone__btn">▢</span>
        </>
      )}
    </div>
  );
}

function SheetList({ rows, hot }: { rows: string[]; hot: number }) {
  return (
    <ul className="n-phone__list">
      {rows.map((row, index) => (
        <li key={row} className={cx(index === hot && 'is-hot')}>
          <span>{row}</span>
          {index === hot ? <AddGlyph /> : null}
        </li>
      ))}
    </ul>
  );
}

function HomeScreen() {
  return (
    <div className="n-phone__home">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="n-phone__app" />
      ))}
      <span className="n-phone__app is-hot">
        <img src="/icons/icon-192.png" alt="" width="40" height="40" />
      </span>
    </div>
  );
}

function PermissionDialog({ allow, deny }: { allow: string; deny: string }) {
  return (
    <div className="n-phone__alert">
      <strong>«Nisseoppdrag»</strong>
      <span>🔔</span>
      <div>
        <span>{deny}</span>
        <span className="is-hot">{allow}</span>
      </div>
    </div>
  );
}

// ---------- the steps per platform ----------

interface Step {
  title: MessageKey;
  body: MessageKey;
  art?: ReactNode;
  /** Replaces «Next» on the last step, e.g. the notification switches. */
  extra?: ReactNode;
}

function useSteps(info: PlatformInfo, onInstalled: () => void): Step[] {
  const { t } = useI18n();
  const install = useInstallPrompt();
  const modernSafari = (info.safariVersion ?? 0) >= 26;
  const notify: Step = {
    title: 'pwa.step.notify.title',
    body: 'pwa.step.notify.body',
    art: (
      <Phone>
        <PermissionDialog allow={t('pwa.art.allow')} deny={t('pwa.art.deny')} />
      </Phone>
    ),
  };
  const openApp: Step = {
    title: 'pwa.step.open.title',
    body: 'pwa.step.open.body',
    art: (
      <Phone>
        <HomeScreen />
      </Phone>
    ),
  };
  const oneTap: Step = {
    title: 'pwa.step.prompt.title',
    body: 'pwa.step.prompt.body',
    extra: (
      <Button
        onClick={() => {
          void install.prompt().then((accepted) => {
            if (accepted) onInstalled();
          });
        }}
      >
        {t('pwa.install.button')}
      </Button>
    ),
  };

  switch (info.platform) {
    case 'standalone':
    case 'desktop-other':
      return [
        {
          title:
            info.platform === 'standalone' ? 'pwa.step.installed.title' : 'pwa.step.firefox.title',
          body:
            info.platform === 'standalone' ? 'pwa.step.installed.body' : 'pwa.step.firefox.body',
          extra: <NotificationsPanel />,
        },
      ];
    case 'ios-inapp':
      return [{ title: 'pwa.step.inapp.title', body: 'pwa.step.inapp.body', extra: <CopyLink /> }];
    case 'ios-safari':
    case 'ios-other':
      return [
        info.platform === 'ios-other'
          ? { title: 'pwa.step.ios_other.title', body: 'pwa.step.ios_other.body' }
          : modernSafari
            ? {
                title: 'pwa.step.more.title',
                body: 'pwa.step.more.body',
                art: (
                  <Phone>
                    <SafariBar modern highlight="more" />
                  </Phone>
                ),
              }
            : {
                title: 'pwa.step.share.title',
                body: 'pwa.step.share.body',
                art: (
                  <Phone>
                    <SafariBar modern={false} highlight="share" />
                  </Phone>
                ),
              },
        {
          title: 'pwa.step.add.title',
          body: 'pwa.step.add.body',
          art: (
            <Phone tall>
              <SheetList
                rows={[t('pwa.art.copy'), t('pwa.art.bookmark'), t('pwa.art.add_home')]}
                hot={2}
              />
            </Phone>
          ),
        },
        {
          title: 'pwa.step.confirm.title',
          body: modernSafari ? 'pwa.step.confirm.body_26' : 'pwa.step.confirm.body',
          art: (
            <Phone>
              <div className="n-phone__head">
                <span>{t('pwa.art.cancel')}</span>
                <span className="is-hot">{t('pwa.art.add')}</span>
              </div>
              <div className="n-phone__appname">
                <img src="/icons/icon-192.png" alt="" width="36" height="36" />
                <span>Nisseoppdrag</span>
              </div>
            </Phone>
          ),
        },
        openApp,
        info.iosTooOldForPush
          ? { title: 'pwa.step.old_ios.title', body: 'pwa.step.old_ios.body' }
          : notify,
      ];
    case 'android':
      return install.canPrompt
        ? [oneTap, openApp, notify]
        : [
            {
              title: 'pwa.step.android_menu.title',
              body: 'pwa.step.android_menu.body',
              art: (
                <Phone>
                  <div className="n-phone__bar n-phone__bar--top">
                    <span className="n-phone__url">nisseoppdrag.no</span>
                    <span className="n-phone__btn is-hot">
                      <DotsGlyph />
                    </span>
                  </div>
                </Phone>
              ),
            },
            { title: 'pwa.step.android_install.title', body: 'pwa.step.android_install.body' },
            openApp,
            notify,
          ];
    case 'desktop-chromium':
      return [
        install.canPrompt
          ? oneTap
          : { title: 'pwa.step.desktop.title', body: 'pwa.step.desktop.body' },
        {
          title: 'pwa.step.desktop_notify.title',
          body: 'pwa.step.desktop_notify.body',
          extra: <NotificationsPanel />,
        },
      ];
    case 'desktop-safari':
      return [
        { title: 'pwa.step.mac.title', body: 'pwa.step.mac.body' },
        {
          title: 'pwa.step.desktop_notify.title',
          body: 'pwa.step.desktop_notify.body',
          extra: <NotificationsPanel />,
        },
      ];
  }
}

function CopyLink() {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <Button
      onClick={() => {
        void navigator.clipboard
          .writeText(window.location.origin)
          .then(() => {
            toast.show(t('pwa.inapp.copied'));
          })
          .catch(() => undefined);
      }}
    >
      {t('pwa.inapp.copy')}
    </Button>
  );
}

/**
 * The step-by-step install guide. On iPhone it walks through Safari's share sheet, because iOS
 * only delivers Web Push to apps on the Home Screen; on Android and computers it uses the
 * browser's own install prompt where there is one.
 */
export function InstallGuide({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const info = useMemo(() => detectPlatform(), []);
  const [index, setIndex] = useState(0);
  const steps = useSteps(info, () => {
    setIndex((i) => i + 1);
  });
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  if (!step) return null;
  // On an iPhone (not an iPad), point at Safari's toolbar during the first step.
  const pointer =
    index === 0 && info.platform === 'ios-safari' && /iPhone/.test(navigator.userAgent);

  return (
    <div className="n-guide" data-platform={info.platform}>
      <p className="n-page__lead">{t('pwa.guide.lead')}</p>
      {steps.length > 1 ? (
        <ol className="n-guide__dots" aria-label={t('pwa.guide.progress')}>
          {steps.map((s, i) => (
            <li key={s.title} aria-current={i === index ? 'step' : undefined}>
              <span className="sr-only">{t(s.title)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <section className="n-guide__step" aria-live="polite" key={step.title}>
        {steps.length > 1 ? (
          <p className="n-guide__count">
            {t('pwa.guide.step', { n: index + 1, total: steps.length })}
          </p>
        ) : null}
        <h3>{t(step.title)}</h3>
        <p>{t(step.body)}</p>
        {step.art ?? null}
        {step.extra ?? null}
      </section>
      <div className="n-row">
        {index > 0 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setIndex(index - 1);
            }}
          >
            {t('pwa.guide.back')}
          </Button>
        ) : null}
        {last ? (
          onDone ? (
            <Button onClick={onDone}>{t('pwa.guide.done')}</Button>
          ) : null
        ) : (
          <Button
            onClick={() => {
              setIndex(index + 1);
            }}
          >
            {t('pwa.guide.next')}
          </Button>
        )}
      </div>
      {pointer ? (
        <div
          className={cx(
            'n-guide__pointer',
            (info.safariVersion ?? 0) >= 26 && 'n-guide__pointer--right',
          )}
          aria-hidden="true"
        >
          ↓
        </div>
      ) : null}
    </div>
  );
}
