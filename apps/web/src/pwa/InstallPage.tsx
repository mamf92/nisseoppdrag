import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { LanguageSwitch } from '../ui';
import { InstallGuide } from './InstallGuide';
import './pwa.css';

/** `/installer`: the install guide as a page, for anyone, signed in or not. */
export default function InstallPage() {
  const { t } = useI18n();
  return (
    <main className="n-page n-install-page">
      <header>
        <img
          src="/icons/icon-192.png"
          alt=""
          width="72"
          height="72"
          className="n-install-page__icon"
        />
        <h1>{t('pwa.guide.title')}</h1>
        <LanguageSwitch />
      </header>
      <InstallGuide />
      <p>
        <Link to="/" className="n-btn n-btn--ghost" style={{ textDecoration: 'none' }}>
          {t('privacy.back')}
        </Link>
      </p>
    </main>
  );
}
