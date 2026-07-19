/** COMMERCE layer — shared date formatting for Admin surfaces. */

/** Formats an ISO date string as "15 Jul 2026, 08:30" (en-NG locale). */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
