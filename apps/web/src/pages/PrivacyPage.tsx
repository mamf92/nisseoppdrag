import { Link } from 'react-router-dom';
import { LanguageSwitch } from '../ui';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

const SECTIONS: readonly { id: string; title: MessageKey; body: MessageKey }[] = [
  { id: 'stored', title: 'privacy.stored.title', body: 'privacy.stored.body' },
  { id: 'seen', title: 'privacy.seen.title', body: 'privacy.seen.body' },
  { id: 'admin', title: 'privacy.admin.title', body: 'privacy.admin.body' },
  { id: 'retention', title: 'privacy.retention.title', body: 'privacy.retention.body' },
  { id: 'delete', title: 'privacy.delete.title', body: 'privacy.delete.body' },
  { id: 'tracking', title: 'privacy.tracking.title', body: 'privacy.tracking.body' },
  { id: 'contact', title: 'privacy.contact.title', body: 'privacy.contact.body' },
];

// Public: reachable without signing in, from the front page and from Meg.
export function PrivacyPage() {
  const t = useT();
  return (
    <main className="n-page">
      <header>
        <h1>{t('privacy.title')}</h1>
        <p className="n-page__lead">{t('privacy.lead')}</p>
        <LanguageSwitch />
      </header>
      {SECTIONS.map((section) => (
        <section key={section.id} aria-labelledby={`p-${section.id}`}>
          <h2 id={`p-${section.id}`}>{t(section.title)}</h2>
          <p>{t(section.body)}</p>
        </section>
      ))}
      <p>
        <Link to="/">{t('privacy.back')}</Link>
      </p>
    </main>
  );
}
