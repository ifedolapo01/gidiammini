/** CORE layer — resolves the app's semantic color tokens to raw CSS values at
 * runtime, for chart libraries (Recharts) that need actual color strings
 * rather than Tailwind classes. Re-resolves whenever data-theme changes on
 * <html> (see lib/theme.ts), since Admin's tokens differ between light/dark
 * and there is no dedicated chart-color token set to read instead. */
'use client';

import { useEffect, useState } from 'react';

const TOKENS = ['primary', 'accent', 'success', 'warning', 'destructive', 'info', 'border', 'text-secondary', 'surface'] as const;

type SemanticColorToken = (typeof TOKENS)[number];

export type SemanticChartColors = Record<SemanticColorToken, string>;

function resolveColors(): SemanticChartColors {
  const styles = getComputedStyle(document.documentElement);
  const colors = {} as SemanticChartColors;
  for (const token of TOKENS) {
    colors[token] = styles.getPropertyValue(`--color-${token}`).trim();
  }
  return colors;
}

const FALLBACK_COLORS: SemanticChartColors = {
  primary: '#2563eb',
  accent: '#6366f1',
  success: '#047857',
  warning: '#b45309',
  destructive: '#dc2626',
  info: '#2563eb',
  border: '#e5e7eb',
  'text-secondary': '#4b5563',
  surface: '#ffffff'
};

export function useSemanticChartColors(): SemanticChartColors {
  const [colors, setColors] = useState<SemanticChartColors>(FALLBACK_COLORS);

  useEffect(() => {
    setColors(resolveColors());

    const observer = new MutationObserver(() => setColors(resolveColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  return colors;
}
