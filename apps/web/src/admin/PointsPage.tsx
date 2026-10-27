import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAdjustPoints, useMembers } from './api';
import { Query, useErrorText } from './shared';
import { validateAdjustment } from './validation';
import { useT } from '../i18n/I18nProvider';
import { Button, TextField, useToast } from '../ui';

export function PointsPage() {
  const t = useT();
  const toast = useToast();
  const errorText = useErrorText();
  const members = useMembers();
  const adjust = useAdjustPoints();
  const [member, setMember] = useState('');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(delta);
    const problem = member === '' ? 'admin.error.member' : validateAdjustment(amount, note);
    if (problem) {
      setError(t(problem));
      return;
    }
    setError(undefined);
    adjust.mutate(
      { member, delta: amount, note },
      {
        onSuccess: () => {
          toast.show(t('admin.points.done'));
          setDelta('');
          setNote('');
        },
        onError: (e) => {
          setError(errorText(e));
        },
      },
    );
  }

  return (
    <Query query={members}>
      {(list) => (
        <form className="n-form" onSubmit={submit} noValidate>
          <p className="n-page__lead">{t('admin.points.lead')}</p>
          <div className="n-field">
            <label htmlFor="adj-member">{t('admin.points.member')}</label>
            <select
              id="adj-member"
              className="n-select"
              value={member}
              onChange={(e) => {
                setMember(e.target.value);
              }}
            >
              <option value="">{t('admin.points.choose')}</option>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label={t('admin.points.delta')}
            hint={t('admin.points.delta.hint')}
            inputMode="numeric"
            value={delta}
            onChange={(e) => {
              setDelta(e.target.value);
            }}
          />
          <TextField
            label={t('admin.points.note')}
            hint={t('admin.points.note.hint')}
            maxLength={120}
            value={note}
            error={error}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <Button type="submit" disabled={adjust.isPending}>
            {t('admin.points.submit')}
          </Button>
        </form>
      )}
    </Query>
  );
}
