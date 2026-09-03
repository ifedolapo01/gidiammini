/**
 * COMMERCE layer — choosing a rating.
 *
 * A radio group, not five buttons. That is the whole accessibility story: the
 * five options are mutually exclusive, so the browser's own radio semantics
 * give arrow-key selection, a single tab stop for the group and an announced
 * "3 of 5" for free — none of which a row of <button>s has, and all of which
 * would otherwise have to be re-implemented with a keydown handler.
 *
 * The inputs are visually hidden rather than absent, so the label's star is
 * what gets clicked while the input keeps the focus ring and the state.
 */
'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** What each rating actually means, spoken. "3 stars" tells a screen-reader
 *  user the number and nothing about the scale. */
const MEANINGS = ['Poor', 'Not great', 'Okay', 'Good', 'Excellent'] as const;

interface RatingInputProps {
  /** 0 for "nothing chosen yet". */
  value: number;
  onChange: (rating: number) => void;
  /** Distinguishes several groups on one page — one per item being reviewed. */
  name: string;
  disabled?: boolean;
  invalid?: boolean;
}

export default function RatingInput({
  value,
  onChange,
  name,
  disabled = false,
  invalid = false,
}: RatingInputProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Your rating, out of 5"
      aria-invalid={invalid || undefined}
      className="inline-flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <label
          key={rating}
          // 44px touch target: the star glyph is small, and this is the one
          // control on the form that has to be hit accurately on a phone.
          className={cn(
            'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-control',
            'transition-colors hover:bg-surface-hover',
            'focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <input
            type="radio"
            name={name}
            value={rating}
            checked={value === rating}
            disabled={disabled}
            onChange={() => onChange(rating)}
            className="sr-only"
          />
          <Star
            aria-hidden="true"
            className={cn(
              'h-7 w-7 transition-colors',
              rating <= value ? 'fill-warning text-warning' : 'text-border-strong'
            )}
          />
          <span className="sr-only">
            {rating} {rating === 1 ? 'star' : 'stars'} — {MEANINGS[rating - 1]}
          </span>
        </label>
      ))}
    </div>
  );
}
