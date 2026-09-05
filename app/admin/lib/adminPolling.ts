/** ADMIN layer — shared background-refresh cadences for admin data hooks.
 * Pages refresh on these intervals instead of requiring a manual Refresh
 * button click. */

/** For hooks that refetch their whole dataset on every tick. Unchanged. */
export const ADMIN_POLL_INTERVAL_MS = 60000;

/** For the change-cursor checks in useListSummary, which transfer no rows —
 * two head-only queries. Cheap enough to run often, so a new order shows up in
 * seconds rather than up to a minute. */
export const ADMIN_CURSOR_POLL_INTERVAL_MS = 15000;

/** The cursor cadence once a realtime subscription is carrying the updates.
 * The poll is not switched off: a socket can drop, or realtime can be
 * unavailable entirely, and a page that quietly stopped updating is worse than
 * one that checks occasionally. This is the safety net behind it. */
export const ADMIN_LIVE_POLL_INTERVAL_MS = 120000;
