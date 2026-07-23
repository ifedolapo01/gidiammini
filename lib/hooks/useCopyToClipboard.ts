/** CORE layer — generic clipboard-copy state, shared by any "Copy" button
 * that needs to briefly show "Copied!" feedback. Business-independent. */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export function useCopyToClipboard(resetDelayMs = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string, successMessage = 'Copied to clipboard!') => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(successMessage);
    setTimeout(() => setCopied(false), resetDelayMs);
  };

  return { copied, copy };
}
