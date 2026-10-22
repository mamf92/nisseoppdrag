import { afterEach, vi } from 'vitest';
import {
  applyTheme,
  defaultTheme,
  initialTheme,
  isTheme,
  readStoredTheme,
  storeTheme,
} from './theme';

function mockMedia(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark }));
}

describe('theme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete document.documentElement.dataset['nisseTheme'];
  });

  it('knows the two themes', () => {
    expect(isTheme('laaven')).toBe(true);
    expect(isTheme('gaarden')).toBe(true);
    expect(isTheme('verkstedet')).toBe(false);
  });

  it('follows the device on the first visit', () => {
    mockMedia(true);
    expect(defaultTheme()).toBe('laaven');
    mockMedia(false);
    expect(defaultTheme()).toBe('gaarden');
  });

  it('prefers the stored choice over the device', () => {
    mockMedia(true);
    storeTheme('gaarden');
    expect(initialTheme()).toBe('gaarden');
  });

  it('ignores a stored value that is not a theme', () => {
    mockMedia(false);
    window.localStorage.setItem('nisse-theme', 'verkstedet');
    expect(readStoredTheme()).toBeNull();
    expect(initialTheme()).toBe('gaarden');
  });

  it('survives storage that throws', () => {
    mockMedia(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(initialTheme()).toBe('laaven');
    expect(() => {
      storeTheme('gaarden');
    }).not.toThrow();
  });

  it('sets the attribute on <html>', () => {
    applyTheme('laaven');
    expect(document.documentElement.dataset['nisseTheme']).toBe('laaven');
  });
});
