/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * `useConfirm()` returns an async `confirm(options)` that resolves true or
 * false, so a guard reads almost exactly as it did with window.confirm:
 *
 *     if (!(await confirm({ title: 'Delete this discount?' }))) return;
 *
 * A context rather than a hook that returns an element, because most of these
 * guards live in plain .ts hooks (useCategories, useDiscounts, …) which cannot
 * render anything. The provider owns the one dialog; the callers own only the
 * question.
 *
 * The pending promise's resolver is held in a ref, not in state: resolving is
 * not a render, and putting a function in useState invites React to call it.
 */
'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import type { ConfirmFn, ConfirmOptions } from './types';

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    setRequest(null);
    // Cleared before calling, so a handler that immediately opens a second
    // confirmation cannot resolve this one twice.
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(confirmed);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open would otherwise leave the first
        // promise pending forever, and its caller waiting on it.
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setRequest(options);
      }),
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        request={request}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used inside a <ConfirmProvider>.');
  }
  return confirm;
}
