import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import type { Db } from './lib/supabase';
import { I18nProvider } from './i18n/I18nProvider';
import type { Language } from './i18n/messages';
import { ThemeProvider } from './themes/ThemeProvider';
import type { Theme } from './themes/theme';
import { IconSprite } from './ui/Icon';
import { ToastProvider } from './ui/Toast';

export function renderWithProviders(
  ui: ReactElement,
  {
    lang = 'nb',
    theme = 'gaarden',
    route = '/',
    client = null,
  }: { lang?: Language; theme?: Theme; route?: string; client?: Db | null } = {},
) {
  // A wrapper (rather than wrapping `ui`) keeps the providers in place when a test re-renders.
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider initial={theme}>
          <I18nProvider initial={lang}>
            <ToastProvider>
              <IconSprite />
              <AuthProvider client={client}>{children}</AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
