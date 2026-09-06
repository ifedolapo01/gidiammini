/**
 * ADMIN layer — a confirmation that can be taken back.
 *
 * For the actions that are genuinely reversible: a status flip, a publish, an
 * unpublish. It is deliberately NOT offered on deletes — an Undo button that
 * cannot actually restore the row is worse than no button, and the deletes in
 * this admin are hard deletes. Those get a confirmation dialog instead (see
 * components/ui/confirm), which is the honest affordance for something with no
 * way back.
 *
 * The window is longer than a default toast because reading the sentence,
 * realising it was the wrong row, and reaching for the button is three
 * distinct beats.
 */
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 8_000;

/**
 * `undo` must perform the inverse itself and must not raise its own undoable
 * toast, or the pair will bounce between each other for as long as someone
 * keeps clicking.
 */
export function toastWithUndo(message: string, undo: () => unknown): void {
  toast.success(message, {
    duration: UNDO_WINDOW_MS,
    action: {
      label: 'Undo',
      onClick: () => {
        void undo();
      },
    },
  });
}
