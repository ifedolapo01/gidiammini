/**
 * ADMIN layer — the two row shapes inside TableDisplayMenu.
 *
 * Split out to keep that file under the size limit. Both are presentation
 * only; the menu owns every piece of state they render.
 */
'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-1.5 text-caption-md font-semibold uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  );
}

/** A row with a tick well on the left, so both sections line up. */
export function CheckRow({
  checked,
  label,
  role,
  onClick,
}: {
  checked: boolean;
  label: string;
  role: 'menuitemradio' | 'menuitemcheckbox';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-control py-1.5 pl-2 pr-3',
        'text-body-sm font-medium whitespace-nowrap text-text-primary transition-colors',
        'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center border transition-colors',
          // Round for the one-of-many choice, square for the independent ones —
          // the shape says which kind of decision each row is.
          role === 'menuitemradio' ? 'rounded-full' : 'rounded-[3px]',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

