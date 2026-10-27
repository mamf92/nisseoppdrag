import type { ReactNode } from 'react';
import { gameErrorKey } from '../game/errors';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../ui';

/** A panel for a failed load, with a retry. */
export function LoadError({ retry }: { retry: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="n-note">
      <p>{t('error.load')}</p>
      <Button variant="ghost" onClick={retry}>
        {t('error.retry')}
      </Button>
    </div>
  );
}

/** Shows the data, or the loading or error state, so each page only writes its happy path. */
export function Query<T>({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; data: T | undefined; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  const t = useT();
  if (query.isPending) return <p role="status">{t('app.loading')}</p>;
  if (query.isError || query.data === undefined) {
    return (
      <LoadError
        retry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <>{children(query.data)}</>;
}

/** The text for a failed admin call: the database's stable code, else a generic message. */
export function useErrorText() {
  const t = useT();
  return (error: unknown) => {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : '';
    return t(gameErrorKey({ message }));
  };
}

export function formatDate(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(lang === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
