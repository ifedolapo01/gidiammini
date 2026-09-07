/**
 * ADMIN layer — reads the receipt image already on screen and offers a
 * best-effort amount/reference guess, so verifying is usually one tap rather
 * than typing both figures while looking back and forth at a phone screen.
 *
 * Runs in the browser (Tesseract.js, WASM) against the same signed URL
 * ReceiptPane already renders — no server infra, no new account, nothing to
 * pay for. Dynamically imported so the ~2MB of WASM never reaches a bundle
 * that doesn't open this screen. Failure is silent: a guess withheld is a
 * blank field the verifier fills in exactly as they do today.
 */
'use client';

import { useEffect, useState } from 'react';
import { extractAmountGuess, extractReferenceGuess } from '@/lib/payments/receipt-ocr';

export interface ReceiptOcrGuess {
  amount: number | null;
  reference: string | null;
}

interface UseReceiptOcrOptions {
  /** The signed receipt URL, once ReceiptPane has one. Null skips OCR entirely. */
  url: string | null;
  /** What's actually owed — the amount a guess is judged plausible against. */
  expectedAmount: number;
  /** Checked verbatim before falling back to a raw digit run. */
  knownReferences: string[];
}

export function useReceiptOcr({ url, expectedAmount, knownReferences }: UseReceiptOcrOptions) {
  const [guess, setGuess] = useState<ReceiptOcrGuess | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    setGuess(null);

    if (!url) return;

    let cancelled = false;
    setReading(true);

    (async () => {
      try {
        const { recognize } = await import('tesseract.js');
        const result = await recognize(url, 'eng');
        if (cancelled) return;

        const text = result.data.text ?? '';
        setGuess({
          amount: extractAmountGuess(text, expectedAmount),
          reference: extractReferenceGuess(text, knownReferences),
        });
      } catch (error) {
        // A receipt OCR can fail for reasons that have nothing to do with the
        // payment itself (a slow connection, an odd image format, a CORS
        // hiccup on the signed URL) — never surface that as an error the
        // verifier has to deal with. They type the figures themselves, same
        // as before this existed.
        console.error('Receipt OCR failed:', error);
      } finally {
        if (!cancelled) setReading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { guess, reading };
}
