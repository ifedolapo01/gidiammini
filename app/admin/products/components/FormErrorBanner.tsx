/**
 * ADMIN layer — inline submit-error banner for the product create/edit forms.
 *
 * Rendered right above the Submit button rather than at the top of the page:
 * every current submit-time check (missing image, missing main image,
 * compression still running, too few images for the colors configured) is
 * about the Images section immediately above it, so the message now sits next
 * to both its cause and the button the admin just clicked — no scrolling up
 * to find out what happened, then back down to fix it.
 */
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface FormErrorBannerProps {
  message?: string;
}

export function FormErrorBanner({ message }: FormErrorBannerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={ref}
      role="alert"
      className="mb-6 p-4 bg-destructive-background border border-destructive-border rounded-surface flex items-start gap-3"
    >
      <div className="bg-destructive/10 p-1.5 rounded-full mt-0.5">
        <X size={16} className="text-destructive" />
      </div>
      <p className="text-destructive font-medium whitespace-pre-line leading-relaxed">{message}</p>
    </div>
  );
}
