/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * The dialog behind useConfirm(). Presentation only: it is handed one request
 * and two callbacks and holds nothing but the text of the typed confirmation.
 *
 * Built on Modal, so it inherits the focus trap, Escape, focus restoration and
 * scroll lock — all four of which window.confirm gave us for free and which
 * any hand-rolled overlay has to earn back.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import type { ConfirmOptions } from './types';

interface ConfirmDialogProps {
  /** Null when nothing is being confirmed. */
  request: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ request, onConfirm, onCancel }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);

  // A fresh request must not inherit the previous one's typing, and the
  // cheapest place to be sure of that is when the request changes.
  useEffect(() => setTyped(''), [request]);

  /**
   * Focus lands on the confirm button for an ordinary confirmation, so Enter
   * works the way it did with window.confirm. It deliberately does NOT for a
   * typed confirmation: the whole point there is that the operator has to stop
   * and read, and a focused, disabled button is the wrong first impression.
   */
  useEffect(() => {
    if (request && !request.typeToConfirm) confirmRef.current?.focus();
  }, [request]);

  if (!request) return null;

  const {
    title,
    message,
    consequences,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = true,
    typeToConfirm,
  } = request;

  const unlocked = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <Modal open onClose={onCancel} title={title} size="sm">
      <div className="mt-2 space-y-4">
        {message && <p className="text-body-sm text-text-secondary">{message}</p>}

        {consequences && consequences.length > 0 && (
          <div
            className={
              destructive
                ? 'rounded-control border border-destructive-border bg-destructive-background p-3'
                : 'rounded-control border border-border bg-background-secondary p-3'
            }
          >
            <p className="flex items-center gap-2 text-caption-md font-semibold uppercase tracking-wider text-text-secondary">
              <AlertTriangle
                className={destructive ? 'size-4 text-destructive' : 'size-4 text-text-muted'}
                aria-hidden="true"
              />
              What this does
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm text-text-primary">
              {consequences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {typeToConfirm && (
          <div>
            <label htmlFor="confirm-phrase" className="block text-body-sm text-text-primary">
              Type <span className="font-semibold">{typeToConfirm}</span> to continue
            </label>
            <Input
              id="confirm-phrase"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-1"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && unlocked) onConfirm();
              }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={!unlocked}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
