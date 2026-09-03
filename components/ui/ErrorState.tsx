/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * The panel every error boundary draws. It lives in Core rather than in either
 * app shell because Storefront and Admin both need it and neither may import
 * the other: the Storefront boundary and the white-label Admin boundary compose
 * this same primitive and differ only in the words and the actions they pass.
 *
 * Announced with role="alert" so a screen reader is told the page failed rather
 * than silently finding different content than it expected.
 */
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title: string;
  description: ReactNode;
  /** Buttons and links — the way out. A boundary with no action is a dead end. */
  actions?: ReactNode;
  /**
   * Next replaces a production error message with an opaque hash. Showing it
   * is what lets someone report "it said d4f9a2" and have that be findable in
   * the server logs; without it a support conversation has nothing to go on.
   */
  digest?: string;
  className?: string;
}

export function ErrorState({ title, description, actions, digest, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16', className)}
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive-background">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>

        <h1 className="mb-3 text-h5 font-bold text-text-primary sm:text-h4">{title}</h1>
        <div className="mb-8 text-body-sm text-text-secondary sm:text-body-md">{description}</div>

        {actions && <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">{actions}</div>}

        {digest && (
          <p className="mt-8 text-caption-md text-text-muted">
            Reference: <code className="font-mono">{digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
