import { afterEach, vi } from 'vitest';
import { MESSAGES, readStoredLanguage, storeLanguage, translate } from './messages';
import type { MessageKey } from './messages';

describe('messages', () => {
  it('has the same keys in bokmål and English', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.nb).sort());
  });

  it('has no empty texts', () => {
    for (const lang of ['nb', 'en'] as const) {
      for (const [key, text] of Object.entries(MESSAGES[lang])) {
        expect(text.trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(MESSAGES.nb) as MessageKey[]) {
      expect(placeholders(MESSAGES.en[key]), key).toEqual(placeholders(MESSAGES.nb[key]));
    }
  });

  it('fills in parameters', () => {
    expect(translate('nb', 'lantern.progress', { done: 2, total: 5 })).toBe('2 av 5 fullført');
    expect(translate('en', 'lantern.progress', { done: 2, total: 5 })).toBe('2 of 5 done');
  });

  it('leaves an unknown placeholder visible rather than printing undefined', () => {
    expect(translate('nb', 'lantern.progress', { done: 2 })).toBe('2 av {total} fullført');
  });

  it('names the app in both languages', () => {
    expect(translate('nb', 'app.name')).toBe('Nisseoppdrag');
    expect(translate('en', 'app.name')).toBe('Nisse Missions');
  });
});

describe('language storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('round-trips the choice', () => {
    storeLanguage('en');
    expect(readStoredLanguage()).toBe('en');
  });

  it('ignores a stored value that is not a language', () => {
    window.localStorage.setItem('nisse-lang', 'xx');
    expect(readStoredLanguage()).toBeNull();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredLanguage()).toBeNull();
    expect(() => {
      storeLanguage('en');
    }).not.toThrow();
  });
});
