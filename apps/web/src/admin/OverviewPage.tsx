import { useAdminStats } from './api';
import { Query } from './shared';
import { useT } from '../i18n/I18nProvider';
import { CATEGORIES, StatTile } from '../ui';

export function OverviewPage() {
  const t = useT();
  const stats = useAdminStats();
  return (
    <Query query={stats}>
      {(s) => (
        <div className="grid gap-4">
          <div className="n-stats">
            <StatTile value={s.members} label={t('admin.stat.members')} />
            <StatTile value={s.activeThisWeek} label={t('admin.stat.active')} />
            <StatTile value={s.skips} label={t('admin.stat.skips')} />
            <StatTile value={s.rerolls} label={t('admin.stat.rerolls')} />
          </div>
          <section aria-labelledby="by-cat">
            <h2 id="by-cat">{t('admin.stat.by_category')}</h2>
            <div className="n-stats">
              {CATEGORIES.map((c) => (
                <StatTile key={c} value={s.byCategory[c]} label={t(`category.${c}`)} />
              ))}
            </div>
          </section>
          {s.catalogLow.length > 0 ? (
            <p role="status" className="n-note">
              {t('admin.stat.low', {
                list: s.catalogLow.map((c) => t(`category.${c}`)).join(', '),
              })}
            </p>
          ) : null}
          <p className="n-page__lead">{t('admin.stat.note')}</p>
        </div>
      )}
    </Query>
  );
}
