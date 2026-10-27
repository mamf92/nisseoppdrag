import { useT } from '../i18n/I18nProvider';

// Stand-in for tabs whose package has not landed yet.
export function ComingSoon() {
  const t = useT();
  return (
    <main className="n-page">
      <p>{t('home.placeholder')}</p>
    </main>
  );
}
