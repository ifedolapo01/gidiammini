/**
 * CORE layer — barrel export for generic UI primitives.
 * Everything here is business-independent and token-driven; safe for use
 * by Commerce, Storefront, and Admin layers alike.
 */
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Input, Textarea, type InputProps, type TextareaProps, type InputVariant, type InputSize } from './Input';
export { Badge, type BadgeTone, type BadgeVariant } from './Badge';
export { Spinner, type SpinnerSize } from './Spinner';
export { Skeleton } from './Skeleton';
export { ErrorState } from './ErrorState';
export { Modal, type ModalSize, type ModalPlacement } from './Modal';
export { Select, type SelectProps, type SelectSize } from './Select';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { FieldError, fieldErrorId, type FieldErrorProps } from './FieldError';
export { ThemeToggle } from './ThemeToggle';
export { Toaster } from './Toaster';
export { NairaSign } from './icons/NairaSign';
export { SkipLink, MAIN_CONTENT_ID } from './SkipLink';
export { LiveAnnouncer } from './LiveAnnouncer';
export { ConfirmProvider, useConfirm } from './confirm/ConfirmProvider';
export type { ConfirmOptions, ConfirmFn } from './confirm/types';
