import { useMemo, useState } from 'react';
import { useChallenges, useSetChallengeState } from './api';
import type { AdminChallenge } from './api';
import { ChallengeForm } from './ChallengeForm';
import { ImportForm } from './ImportSheet';
import { Query, useErrorText } from './shared';
import { emptyDraft } from './validation';
import { useI18n } from '../i18n/I18nProvider';
import { Button, CATEGORIES, Chip, Sheet, useToast } from '../ui';
import type { Category } from '../ui';

type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';

export function ChallengesPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();
  const challenges = useChallenges();
  const setState = useSetChallengeState();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminChallenge | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (challenges.data ?? []).filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (status === 'active' && (!c.isActive || c.archived)) return false;
      if (status === 'inactive' && (c.isActive || c.archived)) return false;
      if (status === 'archived' && !c.archived) return false;
      return needle === '' || `${c.titleNb} ${c.titleEn}`.toLowerCase().includes(needle);
    });
  }, [challenges.data, category, status, search]);

  function change(id: string, change: { isActive: boolean } | { archived: boolean }) {
    setState.mutate(
      { id, change },
      {
        onError: (e) => {
          toast.show(errorText(e), 'error');
        },
      },
    );
  }

  const close = () => {
    setEditing(null);
  };

  return (
    <div className="grid gap-4">
      <div className="n-row">
        <Button
          onClick={() => {
            setEditing('new');
          }}
        >
          {t('admin.missions.new')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setImporting(true);
          }}
        >
          {t('admin.import.open')}
        </Button>
      </div>

      <div className="n-row">
        <div className="n-field">
          <label htmlFor="f-cat">{t('admin.missions.category')}</label>
          <select
            id="f-cat"
            className="n-select"
            value={category}
            onChange={(e) => {
              setCategory(CATEGORIES.find((c) => c === e.target.value) ?? 'all');
            }}
          >
            <option value="all">{t('admin.filter.all')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="n-field">
          <label htmlFor="f-status">{t('admin.filter.status')}</label>
          <select
            id="f-status"
            className="n-select"
            value={status}
            onChange={(e) => {
              const next = (['all', 'active', 'inactive', 'archived'] as const).find(
                (s) => s === e.target.value,
              );
              setStatus(next ?? 'active');
            }}
          >
            {(['active', 'inactive', 'archived', 'all'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`admin.filter.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="n-field">
          <label htmlFor="f-search">{t('admin.filter.search')}</label>
          <input
            id="f-search"
            className="n-select"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      <Query query={challenges}>
        {() =>
          shown.length === 0 ? (
            <p>{t('admin.missions.empty')}</p>
          ) : (
            <ul className="n-lb-list" aria-label={t('admin.tab.missions')}>
              {shown.map((c) => (
                <li key={c.id} className="n-note">
                  <div className="n-row">
                    <Chip>{t(`category.${c.category}`)}</Chip>
                    <Chip>{t('mission.points', { n: c.points })}</Chip>
                    {c.archived ? (
                      <Chip spent>{t('admin.filter.archived')}</Chip>
                    ) : !c.isActive ? (
                      <Chip spent>{t('admin.filter.inactive')}</Chip>
                    ) : null}
                  </div>
                  <b>{lang === 'en' ? c.titleEn : c.titleNb}</b>
                  <div className="n-row">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(c);
                      }}
                    >
                      {t('admin.edit')}
                      <span className="sr-only"> {lang === 'en' ? c.titleEn : c.titleNb}</span>
                    </Button>
                    {!c.archived ? (
                      <Button
                        variant="ghost"
                        disabled={setState.isPending}
                        onClick={() => {
                          change(c.id, { isActive: !c.isActive });
                        }}
                      >
                        {t(c.isActive ? 'admin.missions.deactivate' : 'admin.missions.activate')}
                        <span className="sr-only"> {lang === 'en' ? c.titleEn : c.titleNb}</span>
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      disabled={setState.isPending}
                      onClick={() => {
                        change(c.id, { archived: !c.archived });
                      }}
                    >
                      {t(c.archived ? 'admin.missions.restore' : 'admin.missions.archive')}
                      <span className="sr-only"> {lang === 'en' ? c.titleEn : c.titleNb}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Query>

      <Sheet
        open={editing !== null}
        onClose={close}
        title={t(editing === 'new' ? 'admin.missions.new' : 'admin.missions.edit')}
      >
        {editing ? (
          <ChallengeForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? emptyDraft() : editing}
            id={editing === 'new' ? null : editing.id}
            onDone={close}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={importing}
        onClose={() => {
          setImporting(false);
        }}
        title={t('admin.import.open')}
      >
        {importing ? (
          <ImportForm
            onDone={() => {
              setImporting(false);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
