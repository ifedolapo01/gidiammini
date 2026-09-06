/**
 * CORE layer — the shape of a confirmation request.
 *
 * Everything a `window.confirm` could not carry: a heading separate from the
 * body, the specific consequences of going ahead, a named action on the button
 * instead of "OK", and — for the handful of deletes that cannot be walked back
 * — a phrase the operator has to type out.
 */
export interface ConfirmOptions {
  /** The question, as a heading. "Delete this category?" */
  title: string;
  /** One or two sentences of context. Optional when the title says it all. */
  message?: string;
  /**
   * What will actually happen, one item per line. This is the part
   * window.confirm structurally could not do: "Deletes 4 subcategories",
   * "Orphans 23 products". Say what is true, not what is scary.
   */
  consequences?: string[];
  /** Names the action rather than agreeing with a question. Default "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Red confirm button and a destructive framing. Default true, because every
   * caller so far is a delete or a cancellation.
   */
  destructive?: boolean;
  /**
   * When set, the confirm button stays disabled until the operator types this
   * exact string. For the deletes with no undo — reserve it for those, or it
   * becomes a reflex and stops being a pause.
   */
  typeToConfirm?: string;
}

/** Resolves true if the operator confirmed, false on cancel, Escape or backdrop. */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
