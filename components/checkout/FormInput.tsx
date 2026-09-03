/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { FieldError, fieldErrorId } from '@/components/ui';
import { cn } from '@/lib/utils';

interface FormInputProps {
  type?: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  /** Names the field for the error id, so the message is announced against the
   * right input. Falls back to the label when not given. */
  name?: string;
  /** A validation message from the server. When set, the field is marked
   * invalid and the message is shown beneath it. */
  error?: string;
}

// Judgment call: kept as its own thin wrapper rather than Core's <Input> — Input's
// size scale is a fixed height (e.g. h-11) with non-responsive px-3, while this
// field needs responsive px-3 sm:px-4 py-2 sm:py-3 with no fixed height. Since
// cn() has no tailwind-merge, passing overrides via className would leave both
// class sets (e.g. border-border vs border-border-strong) in the output with an
// unpredictable winner — the same risk PaymentStep documents for Button.
export default function FormInput({
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  name,
  error,
}: FormInputProps) {
  const field = name ?? label;
  const errorId = fieldErrorId(field);

  return (
    <div>
      <label className="block text-caption-md sm:text-body-sm font-medium text-text-primary mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'w-full bg-surface text-text-primary rounded-control px-3 sm:px-4 py-2 sm:py-3 text-body-sm',
          error
            ? 'border border-destructive focus-visible:border-destructive'
            : 'border border-border-strong focus-visible:border-focus',
        )}
        required
      />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
