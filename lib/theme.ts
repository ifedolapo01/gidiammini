/**
 * CORE layer — theme persistence key.
 * Kept in sync with the inline no-flash script in app/layout.tsx, which
 * duplicates this value as a plain string since it runs before any module
 * import is possible.
 */
export const THEME_STORAGE_KEY = 'gidiam-theme';

export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* localStorage unavailable (private browsing, etc.) — theme still applies for this session. */
  }
}
