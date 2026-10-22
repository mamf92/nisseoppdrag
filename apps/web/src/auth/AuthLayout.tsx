import type { ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { LanguageSwitch, ThemeSwitch } from '../ui';

export function AuthLayout({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <main className="mx-auto grid max-w-md gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="n-eyebrow">{t('app.name')}</p>
        <div className="flex gap-2">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </div>
      {children}
    </main>
  );
}
