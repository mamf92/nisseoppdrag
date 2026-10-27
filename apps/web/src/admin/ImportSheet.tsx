import { useState } from 'react';
import { useImportChallenges } from './api';
import { CSV_EXAMPLE, readChallengeCsv } from './csv';
import type { ImportRow } from './csv';
import { useErrorText } from './shared';
import { useT } from '../i18n/I18nProvider';
import { Button, useToast } from '../ui';

const MAX_BYTES = 200_000;

// CSV import with a verdict for every row. Only the valid rows are added, in one insert.
export function ImportForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const errorText = useErrorText();
  const importer = useImportChallenges();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [problem, setProblem] = useState<string | undefined>();

  async function read(file: File | undefined) {
    setProblem(undefined);
    setRows(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setProblem(t('admin.import.too_big'));
      return;
    }
    const result = readChallengeCsv(await file.text());
    if (result.headerError) setProblem(t('admin.import.header'));
    else if (result.rows.length === 0) setProblem(t('admin.import.empty'));
    else setRows(result.rows);
  }

  const valid = (rows ?? []).flatMap((row) => (row.draft ? [row.draft] : []));
  const bad = (rows ?? []).filter((row) => !row.draft);

  return (
    <div className="n-form">
      <p>{t('admin.import.lead')}</p>
      <pre className="n-code" aria-label={t('admin.import.example')}>
        {CSV_EXAMPLE}
      </pre>
      <div className="n-field">
        <label htmlFor="csv-file">{t('admin.import.file')}</label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            void read(e.target.files?.[0]);
          }}
        />
      </div>
      {problem ? <p role="alert">{problem}</p> : null}
      {rows ? (
        <>
          <p role="status">{t('admin.import.summary', { ok: valid.length, bad: bad.length })}</p>
          {bad.length > 0 ? (
            <ul aria-label={t('admin.import.problems')}>
              {bad.map((row) => (
                <li key={row.line}>
                  {t('admin.import.line', { n: row.line })}:{' '}
                  {row.errors.map((key) => t(key)).join(' ')}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <div className="n-row">
        <Button
          disabled={valid.length === 0 || importer.isPending}
          onClick={() => {
            importer.mutate(valid, {
              onSuccess: () => {
                toast.show(t('admin.import.done', { n: valid.length }));
                onDone();
              },
              onError: (e) => {
                setProblem(errorText(e));
              },
            });
          }}
        >
          {t('admin.import.submit', { n: valid.length })}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
