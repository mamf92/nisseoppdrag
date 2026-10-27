import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSaveSeason, useSeasons } from './api';
import type { AdminSeason } from './api';
import { Query, formatDate, useErrorText } from './shared';
import { validateSeason } from './validation';
import type { SeasonDraft, SeasonErrors } from './validation';
import { useI18n } from '../i18n/I18nProvider';
import { Button, Sheet, TextField, useToast } from '../ui';

const STATUSES = ['draft', 'active', 'finished'] as const;

function nextMonday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function blank(): SeasonDraft {
  const start = nextMonday();
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7 * 6 - 1);
  return {
    name: '',
    startsOn: start,
    endsOn: end.toISOString().slice(0, 10),
    hour: 6,
    status: 'draft',
  };
}

function SeasonForm({
  initial,
  id,
  onDone,
}: {
  initial: SeasonDraft;
  id: string | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();
  const save = useSaveSeason();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<SeasonErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const set = <K extends keyof SeasonDraft>(key: K, value: SeasonDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateSeason(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFormError(undefined);
    save.mutate(
      { id, draft },
      {
        onSuccess: () => {
          toast.show(t('admin.season.saved'));
          onDone();
        },
        onError: (e) => {
          setFormError(errorText(e));
        },
      },
    );
  }

  const error = (key: keyof SeasonErrors) => {
    const message = errors[key];
    return message ? t(message) : undefined;
  };

  return (
    <form className="n-form" onSubmit={submit} noValidate>
      <TextField
        label={t('admin.season.name')}
        value={draft.name}
        maxLength={60}
        error={error('name')}
        onChange={(e) => {
          set('name', e.target.value);
        }}
      />
      <TextField
        label={t('admin.season.starts')}
        hint={t('admin.season.starts.hint')}
        type="date"
        value={draft.startsOn}
        error={error('startsOn')}
        onChange={(e) => {
          set('startsOn', e.target.value);
        }}
      />
      <TextField
        label={t('admin.season.ends')}
        hint={t('admin.season.ends.hint')}
        type="date"
        value={draft.endsOn}
        error={error('endsOn')}
        onChange={(e) => {
          set('endsOn', e.target.value);
        }}
      />
      <TextField
        label={t('admin.season.hour')}
        hint={t('admin.season.hour.hint')}
        type="number"
        min={0}
        max={23}
        value={String(draft.hour)}
        error={error('hour')}
        onChange={(e) => {
          set('hour', Number(e.target.value));
        }}
      />
      <div className="n-field">
        <label htmlFor="season-status">{t('admin.season.status')}</label>
        <select
          id="season-status"
          className="n-select"
          value={draft.status}
          onChange={(e) => {
            set('status', e.target.value as SeasonDraft['status']);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.season.status.${s}`)}
            </option>
          ))}
        </select>
      </div>
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
  );
}

export function SeasonPage() {
  const { t, lang } = useI18n();
  const seasons = useSeasons();
  const [editing, setEditing] = useState<AdminSeason | 'new' | null>(null);
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
          {t('admin.season.new')}
        </Button>
      </div>
      <Query query={seasons}>
        {(list) =>
          list.length === 0 ? (
            <p>{t('admin.season.empty')}</p>
          ) : (
            <ul className="n-lb-list">
              {list.map((s) => (
                <li key={s.id} className="n-note">
                  <b>{s.name}</b>
                  <span>
                    {formatDate(s.startsOn, lang)} – {formatDate(s.endsOn, lang)} ·{' '}
                    {t(`admin.season.status.${s.status}`)}
                  </span>
                  {s.status !== 'finished' ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(s);
                      }}
                    >
                      {t('admin.edit')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        }
      </Query>
      <Sheet
        open={editing !== null}
        onClose={close}
        title={t(editing === 'new' ? 'admin.season.new' : 'admin.season.edit')}
      >
        {editing ? (
          <SeasonForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? blank() : editing}
            id={editing === 'new' ? null : editing.id}
            onDone={close}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
