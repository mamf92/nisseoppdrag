import { badgeFile, useBadges } from '../game/queries';
import { useI18n, useT } from '../i18n/I18nProvider';
import { Badge, Button } from '../ui';

export function BadgesPage() {
  const t = useT();
  const { lang } = useI18n();
  const badges = useBadges();
  const list = badges.data ?? [];
  const unlocked = list.filter((b) => b.unlockedAt !== null).length;

  return (
    <main className="n-page">
      <header>
        <h1>{t('badges.title')}</h1>
        <p className="n-page__lead">
          {badges.isSuccess ? t('badges.count', { n: unlocked, total: list.length }) : ''}
        </p>
      </header>

      {badges.isPending ? <p role="status">{t('app.loading')}</p> : null}
      {badges.isError ? (
        <div role="alert" className="n-note">
          <p>{t('error.load')}</p>
          <Button
            variant="ghost"
            onClick={() => {
              void badges.refetch();
            }}
          >
            {t('error.retry')}
          </Button>
        </div>
      ) : null}

      {badges.isSuccess ? (
        <ul className="n-badges">
          {list.map((badge) => {
            const name = lang === 'en' ? badge.nameEn : badge.nameNb;
            const how = lang === 'en' ? badge.descriptionEn : badge.descriptionNb;
            const isUnlocked = badge.unlockedAt !== null;
            return (
              <li key={badge.code}>
                <Badge
                  file={badgeFile(badge.code)}
                  name={name}
                  state={isUnlocked ? 'unlocked' : 'locked'}
                />
                <small>{how}</small>
              </li>
            );
          })}
          {/* Secret badges are hidden by the database until they are unlocked. */}
          <li>
            <Badge file="" name="" state="secret" />
            <small>{t('badges.secret.hint')}</small>
          </li>
        </ul>
      ) : null}
    </main>
  );
}
