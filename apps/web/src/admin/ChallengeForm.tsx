import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSaveChallenge } from './api';
import { useErrorText } from './shared';
import {
  BODY_MAX,
  POINTS_MAX,
  POINTS_MIN,
  TITLE_MAX,
  defaultPoints,
  validateChallenge,
} from './validation';
import type { ChallengeDraft, ChallengeErrors } from './validation';
import { useI18n } from '../i18n/I18nProvider';
import type { Language } from '../i18n/messages';
import { THEMES } from '../themes/theme';
import { Button, CATEGORIES, MissionCard, TextField, useToast } from '../ui';

// What the player will see, in both themes, in the chosen language.
function Preview({ draft, lang }: { draft: ChallengeDraft; lang: Language }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3" aria-label={t('admin.preview')} role="group">
      {THEMES.map((theme) => (
        <div
          key={theme}
          data-nisse-theme={theme}
          data-testid={`preview-${theme}`}
          className="grid gap-2 rounded-card bg-bg p-3 text-ink"
        >
          <p className="n-eyebrow">{t(`theme.${theme}`)}</p>
          <MissionCard
            category={draft.category}
            title={(lang === 'en' ? draft.titleEn : draft.titleNb) || t('admin.preview.title')}
            body={lang === 'en' ? draft.bodyEn : draft.bodyNb}
            points={draft.points}
            difficulty={draft.difficulty}
            status="open"
          />
        </div>
      ))}
    </div>
  );
}

export function ChallengeForm({
  initial,
  id,
  onDone,
}: {
  initial: ChallengeDraft;
  id: string | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();
  const save = useSaveChallenge();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<ChallengeErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [previewLang, setPreviewLang] = useState<Language>('nb');
  const set = <K extends keyof ChallengeDraft>(key: K, value: ChallengeDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const error = (key: keyof ChallengeErrors) => {
    const message = errors[key];
    return message ? t(message) : undefined;
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateChallenge(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFormError(undefined);
    save.mutate(
      { id, draft },
      {
        onSuccess: () => {
          toast.show(t('admin.missions.saved'));
          onDone();
        },
        onError: (e) => {
          setFormError(errorText(e));
        },
      },
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form className="n-form" onSubmit={submit} noValidate>
        <div className="n-field">
          <label htmlFor="ch-category">{t('admin.missions.category')}</label>
          <select
            id="ch-category"
            className="n-select"
            value={draft.category}
            onChange={(e) => {
              const next = CATEGORIES.find((c) => c === e.target.value);
              if (next) set('category', next);
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label={t('admin.missions.title_nb')}
          maxLength={TITLE_MAX}
          value={draft.titleNb}
          error={error('titleNb')}
          onChange={(e) => {
            set('titleNb', e.target.value);
          }}
        />
        <TextField
          label={t('admin.missions.title_en')}
          maxLength={TITLE_MAX}
          value={draft.titleEn}
          error={error('titleEn')}
          onChange={(e) => {
            set('titleEn', e.target.value);
          }}
        />
        <div className="n-field">
          <label htmlFor="ch-body-nb">{t('admin.missions.body_nb')}</label>
          <textarea
            id="ch-body-nb"
            className="n-textarea"
            rows={3}
            maxLength={BODY_MAX}
            value={draft.bodyNb}
            onChange={(e) => {
              set('bodyNb', e.target.value);
            }}
          />
          {error('bodyNb') ? <p className="n-field__error">{error('bodyNb')}</p> : null}
        </div>
        <div className="n-field">
          <label htmlFor="ch-body-en">{t('admin.missions.body_en')}</label>
          <textarea
            id="ch-body-en"
            className="n-textarea"
            rows={3}
            maxLength={BODY_MAX}
            value={draft.bodyEn}
            onChange={(e) => {
              set('bodyEn', e.target.value);
            }}
          />
          {error('bodyEn') ? <p className="n-field__error">{error('bodyEn')}</p> : null}
        </div>
        <div className="n-field">
          <label htmlFor="ch-difficulty">{t('admin.missions.difficulty')}</label>
          <select
            id="ch-difficulty"
            className="n-select"
            value={draft.difficulty}
            onChange={(e) => {
              const level = e.target.value === '3' ? 3 : e.target.value === '2' ? 2 : 1;
              // The suggested points follow the level until the admin has set their own.
              setDraft((d) => ({
                ...d,
                difficulty: level,
                points: d.points === defaultPoints(d.difficulty) ? defaultPoints(level) : d.points,
              }));
            }}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {t('mission.difficulty', { n })}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label={t('admin.missions.points')}
          hint={t('admin.missions.points.hint', { min: POINTS_MIN, max: POINTS_MAX })}
          type="number"
          min={POINTS_MIN}
          max={POINTS_MAX}
          value={String(draft.points)}
          error={error('points')}
          onChange={(e) => {
            set('points', Number(e.target.value));
          }}
        />
        {formError ? <p role="alert">{formError}</p> : null}
        <div className="n-row">
          <Button type="submit" disabled={save.isPending}>
            {t('admin.save')}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>

      <div className="grid content-start gap-3">
        <div className="n-segmented" role="group" aria-label={t('admin.preview.language')}>
          {(['nb', 'en'] as const).map((value) => (
            <button
              key={value}
              type="button"
              lang={value}
              aria-pressed={previewLang === value}
              onClick={() => {
                setPreviewLang(value);
              }}
            >
              {t(`language.${value}`)}
            </button>
          ))}
        </div>
        <Preview draft={draft} lang={previewLang} />
      </div>
    </div>
  );
}
