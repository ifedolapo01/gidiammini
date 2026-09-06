/**
 * CORE layer — the one way to say something to a screen reader.
 *
 * A tiny publish/subscribe channel between anywhere in the app and the single
 * live region <LiveAnnouncer /> mounts in each layout. Call `announce(...)`
 * from an event handler, a hook, anywhere — there is no context to thread and
 * no ref to hold.
 *
 * WHAT DOES *NOT* BELONG HERE
 *
 * Toasts. sonner renders its own aria-live region and announces every toast it
 * shows, so calling announce() beside a toast makes a screen reader say the
 * same sentence twice. This is for the state changes that produce no toast and
 * no dialog: a number that ticks up in place, an item that disappears from a
 * list, a control that flips state without moving focus.
 *
 * Dialogs are likewise already covered — opening one moves focus and its
 * accessible name is read out (see CartDrawer, which is how "added to cart"
 * gets announced).
 */

export type Politeness = 'polite' | 'assertive';

export interface Announcement {
  message: string;
  politeness: Politeness;
  /** Distinguishes two identical consecutive messages, so both are spoken. */
  token: number;
}

type Listener = (announcement: Announcement) => void;

const listeners = new Set<Listener>();
let token = 0;

/**
 * Say something. `polite` waits for the reader to finish its current sentence
 * and is right for almost everything; `assertive` interrupts and is only for
 * something the user must hear before they act again.
 */
export function announce(message: string, politeness: Politeness = 'polite'): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  token += 1;
  const announcement: Announcement = { message: trimmed, politeness, token };
  for (const listener of listeners) listener(announcement);
}

/** Used by <LiveAnnouncer />. Returns its own unsubscribe. */
export function subscribeToAnnouncements(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
