import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readStoredLanguage, storeLanguage, translate } from './messages';
import type { Language, MessageKey, MessageParams } from './messages';

export type TFunction = (key: MessageKey, params?: MessageParams) => string;

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  // Bokmål is the default; English is a choice the player makes.
  const [lang, setLangState] = useState<Language>(() => initial ?? readStoredLanguage() ?? 'nb');

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    storeLanguage(next);
    setLangState(next);
  }, []);

  const t = useCallback<TFunction>((key, params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function useT(): TFunction {
  return useI18n().t;
}
