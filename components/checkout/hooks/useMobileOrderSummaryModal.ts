/** STOREFRONT layer — open/close handlers for the mobile order-summary <dialog>. */

export function useMobileOrderSummaryModal() {
  const open = () => {
    const modal = document.getElementById('mobile-order-summary');
    (modal as HTMLDialogElement | null)?.showModal?.();
  };

  const close = () => {
    const modal = document.getElementById('mobile-order-summary');
    (modal as HTMLDialogElement | null)?.close?.();
  };

  return { open, close };
}
