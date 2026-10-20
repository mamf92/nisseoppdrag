import enJson from './en.json';
import nbJson from './nb.json';

// nb.json is the source of truth for the key set; en.json must provide exactly the same keys.
export type MessageKey = keyof typeof nbJson;
export type Messages = Record<MessageKey, string>;

export const LANGUAGES = ['nb', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const MESSAGES: Record<Language, Messages> = { nb: nbJson, en: enJson };

export type MessageParams = Record<string, string | number>;

export function translate(lang: Language, key: MessageKey, params?: MessageParams): string {
  const template = MESSAGES[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export const LANGUAGE_STORAGE_KEY = 'nisse-lang';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function readStoredLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // The choice then lasts for this visit only.
  }
}
