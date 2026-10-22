export const THEMES = ['gaarden', 'laaven'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'nisse-theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

// Storage can throw (private windows, blocked site data), so every access is wrapped.
export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice then lasts for this visit only.
  }
}

// First visit: follow the device. A dark device gets the night barn, everything else the farm.
export function defaultTheme(): Theme {
  const dark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'laaven' : 'gaarden';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['nisseTheme'] = theme;
}

export function initialTheme(): Theme {
  return readStoredTheme() ?? defaultTheme();
}
