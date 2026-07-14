/**
 * CORE layer — generic utilities. No business logic or branding.
 */

type ClassValue = string | number | null | false | undefined;

/** Joins conditional class names, skipping falsy values. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
