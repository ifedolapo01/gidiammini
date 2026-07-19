/** ADMIN layer — shared loading/error/success/form chrome for the product create & edit pages. */
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';

function BackToProductsLink() {
  return (
    <Link
      href="/admin/products"
      className="inline-flex items-center gap-2 text-text-secondary hover:text-primary font-medium mb-6 transition-colors bg-surface px-4 py-2 rounded-control shadow-elevation-1 border border-border-light"
    >
      <ArrowLeft size={20} />
      Back to Products
    </Link>
  );
}

export interface ProductFormShellProps {
  title: string;
  subtitle: string;
  isLoading?: boolean;
  loadError?: string | null;
  loadErrorContext?: string;
  onRetryLoad?: () => void;
  success?: boolean;
  successTitle?: string;
  successMessage?: string;
  successActions?: ReactNode;
  submitError?: string;
  children: ReactNode;
}

export function ProductFormShell({
  title,
  subtitle,
  isLoading,
  loadError,
  loadErrorContext,
  onRetryLoad,
  success,
  successTitle,
  successMessage,
  successActions,
  submitError,
  children,
}: ProductFormShellProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-secondary p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <BackToProductsLink />
          <div className="flex justify-center items-center h-64">
            <Spinner size="xl" className="text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background-secondary p-4 md:p-8 flex items-center justify-center">
        <div className="bg-surface border border-border rounded-surface shadow-elevation-4 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-destructive-background rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-h4 font-bold text-text-primary mb-3">Error Loading Product</h2>
          <p className="text-text-secondary mb-4">{loadError}</p>
          {loadErrorContext && <p className="text-body-sm text-text-secondary mb-8">{loadErrorContext}</p>}
          <div className="space-y-3">
            <Link
              href="/admin/products"
              className="block w-full bg-primary text-primary-foreground py-3 rounded-control font-semibold hover:bg-primary-hover transition-colors"
            >
              Back to Products
            </Link>
            <Button type="button" variant="outline" size="lg" onClick={onRetryLoad} className="w-full font-semibold">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background-secondary">
        <div className="bg-surface border border-border rounded-surface shadow-elevation-4 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-success-background rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-h3 font-bold text-text-primary mb-3">{successTitle}</h2>
          <p className="text-text-secondary mb-8">{successMessage}</p>
          {successActions}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <BackToProductsLink />

        <div className="bg-surface rounded-surface shadow-elevation-3 border border-border-light overflow-hidden">
          <div className="border-b border-border-light bg-background-secondary/50 px-8 py-6">
            <h1 className="text-h3 font-bold text-text-primary">{title}</h1>
            <p className="text-text-secondary mt-1">{subtitle}</p>
          </div>

          <div className="p-8">
            {submitError && (
              <div className="mb-8 p-4 bg-destructive-background border border-destructive-border rounded-surface flex items-start gap-3">
                <div className="bg-destructive/10 p-1.5 rounded-full mt-0.5">
                  <X size={16} className="text-destructive" />
                </div>
                <p className="text-destructive font-medium whitespace-pre-line leading-relaxed">{submitError}</p>
              </div>
            )}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
