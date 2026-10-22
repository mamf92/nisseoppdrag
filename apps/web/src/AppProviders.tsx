import type { ReactNode } from 'react';
import { I18nProvider } from './i18n/I18nProvider';
import { ThemeProvider } from './themes/ThemeProvider';
import { IconSprite } from './ui/Icon';
import { ToastProvider } from './ui/Toast';

// Theme, language, toasts and the inline icon sprite: everything the UI kit needs from above.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <IconSprite />
          {children}
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
