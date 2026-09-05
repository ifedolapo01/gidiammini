/** ADMIN layer — the dialogs a status change opens before it happens.
 *
 * One component so the page has one line for "a transition may need asking
 * about first" rather than a branch per status. Which statuses those are lives
 * in useStatusTransition; this only renders whatever it put in front.
 *
 * Rendered at page level rather than inside OrderCard: a status change can be
 * started from a card, from the details panel or from the bulk bar, and one
 * dialog per row would mount a dozen of them behind whichever is open.
 */
'use client';

import CancelOrderDialog from './CancelOrderDialog';
import ShipOrderDialog from './ShipOrderDialog';
import type { PendingTransition, TransitionExtras } from '../hooks/useStatusTransition';

interface OrderTransitionDialogsProps {
  pending: PendingTransition | null;
  saving: boolean;
  onConfirm: (extras: TransitionExtras) => void;
  onDismiss: () => void;
}

export default function OrderTransitionDialogs({
  pending,
  saving,
  onConfirm,
  onDismiss,
}: OrderTransitionDialogsProps) {
  if (!pending) return null;

  if (pending.status === 'cancelled') {
    return (
      <CancelOrderDialog
        order={pending.order}
        saving={saving}
        onClose={onDismiss}
        onConfirm={onConfirm}
      />
    );
  }

  if (pending.status === 'shipped') {
    return (
      <ShipOrderDialog
        order={pending.order}
        saving={saving}
        onClose={onDismiss}
        onConfirm={onConfirm}
      />
    );
  }

  // A status useStatusTransition queued but nothing here renders. Not silently
  // ignored: it would leave the operator's click doing nothing at all.
  console.error(`No dialog is defined for the "${pending.status}" transition.`);
  return null;
}
