/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

interface FormInputProps {
  type?: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

// Judgment call: kept as its own thin wrapper rather than Core's <Input> — Input's
// size scale is a fixed height (e.g. h-11) with non-responsive px-3, while this
// field needs responsive px-3 sm:px-4 py-2 sm:py-3 with no fixed height. Since
// cn() has no tailwind-merge, passing overrides via className would leave both
// class sets (e.g. border-border vs border-border-strong) in the output with an
// unpredictable winner — the same risk PaymentStep documents for Button.
export default function FormInput({ type = 'text', label, value, onChange, placeholder }: FormInputProps) {
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
        className="w-full border border-border-strong bg-surface text-text-primary rounded-control px-3 sm:px-4 py-2 sm:py-3 text-body-sm focus-visible:border-focus"
        required
      />
    </div>
  );
}
