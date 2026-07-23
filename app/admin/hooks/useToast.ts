/** ADMIN layer — small reusable toast-trigger hook, backed by sonner's global Toaster. */
'use client';

import { toast } from 'sonner';

export function useToast() {
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  return { showToast };
}
