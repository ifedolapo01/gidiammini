/** ADMIN layer — one labelled setting: a field, what it does, and what is
 *  wrong with it.
 *
 *  Every setting on this page needs the same three things, and the hint is not
 *  optional decoration. "Low stock threshold: 5" tells an owner nothing about
 *  what turning it to 20 will do; the line underneath is what makes the page
 *  usable by the person it is for. So the hint is a required prop rather than
 *  one that gets left off in a hurry.
 */
'use client';

import { Checkbox, FieldError, Input, fieldErrorId } from '@/components/ui';

interface BaseProps {
  id: string;
  label: string;
  /** What this setting actually does, in the owner's terms. Required. */
  hint: string;
  error?: string;
}

interface TextFieldProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  placeholder?: string;
  /** Rendered before the input, inside the field — a currency mark or a %. */
  prefix?: string;
  suffix?: string;
  autoComplete?: string;
}

export function SettingsField({
  id, label, hint, error, value, onChange,
  type = 'text', inputMode, placeholder, prefix, suffix, autoComplete = 'off',
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-body-sm font-medium text-text-primary mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {prefix && <span aria-hidden className="text-body-sm text-text-secondary">{prefix}</span>}
        <Input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          invalid={!!error}
          aria-describedby={error ? fieldErrorId(id) : `${id}-hint`}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <span aria-hidden className="text-body-sm text-text-secondary">{suffix}</span>}
      </div>
      <p id={`${id}-hint`} className="mt-1 text-caption-md text-text-secondary">{hint}</p>
      <FieldError id={fieldErrorId(id)}>{error}</FieldError>
    </div>
  );
}

interface ToggleProps extends BaseProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingsToggle({ id, label, hint, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <div>
        <label htmlFor={id} className="block text-body-sm font-medium text-text-primary cursor-pointer">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-caption-md text-text-secondary">{hint}</p>
      </div>
    </div>
  );
}

/** A titled group of settings. One card per thing an owner would come to this
 *  page to change, so "we've moved bank" is one place to look rather than four
 *  fields scattered down a single long form. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-border rounded-surface shadow-elevation-1 p-4 sm:p-6">
      <h2 className="text-body-lg font-bold text-text-primary">{title}</h2>
      <p className="text-body-sm text-text-secondary mt-1 mb-4">{description}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}
