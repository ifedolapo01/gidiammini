/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 */
import { cn } from '@/lib/utils';

const tones = {
  neutral: {
    solid: 'bg-background-tertiary text-text-primary',
    subtle: 'bg-background-secondary text-text-secondary border border-border',
    outline: 'border border-border-strong text-text-secondary',
  },
  primary: {
    solid: 'bg-primary text-primary-foreground',
    subtle: 'bg-secondary text-primary border border-border',
    outline: 'border border-primary text-primary',
  },
  success: {
    solid: 'bg-success text-text-inverse',
    subtle: 'bg-success-background text-success border border-success-border',
    outline: 'border border-success text-success',
  },
  warning: {
    solid: 'bg-warning text-text-inverse',
    subtle: 'bg-warning-background text-warning border border-warning-border',
    outline: 'border border-warning text-warning',
  },
  destructive: {
    solid: 'bg-destructive text-text-inverse',
    subtle: 'bg-destructive-background text-destructive border border-destructive-border',
    outline: 'border border-destructive text-destructive',
  },
  info: {
    solid: 'bg-info text-text-inverse',
    subtle: 'bg-info-background text-info border border-info-border',
    outline: 'border border-info text-info',
  },
} as const;

export type BadgeTone = keyof typeof tones;
export type BadgeVariant = 'solid' | 'subtle' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
}

export function Badge({
  tone = 'neutral',
  variant = 'subtle',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption-md font-medium whitespace-nowrap',
        tones[tone][variant],
        className,
      )}
      {...props}
    />
  );
}
