/**
 * ADMIN layer — the comfortable/compact switch that sits above a table.
 *
 * A two-option radio group rather than a single toggle button, because "which
 * one am I on" should be readable without inferring it from the button's
 * label. Both options are always visible and the current one is pressed.
 */
'use client';

import { Rows2, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableDensity } from './table-styles';

interface DensityToggleProps {
  density: TableDensity;
  onChange: (density: TableDensity) => void;
  className?: string;
}

const OPTIONS: Array<{ value: TableDensity; label: string; Icon: typeof Rows2 }> = [
  { value: 'comfortable', label: 'Comfortable', Icon: Rows2 },
  { value: 'compact', label: 'Compact', Icon: Rows3 },
];

export function DensityToggle({ density, onChange, className }: DensityToggleProps) {
  return (
    <div
      role="group"
      aria-label="Row density"
      className={cn('inline-flex rounded-control border border-border-strong p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = density === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={active}
            title={`${label} rows`}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-[calc(var(--control-radius)-2px)] transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{label} rows</span>
          </button>
        );
      })}
    </div>
  );
}
