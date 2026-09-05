/**
 * COMMERCE layer (server only) — task name to resolver, in one table.
 *
 * The endpoint takes a task name off the URL and needs to turn it into a
 * query. A switch inside the route would put the whole worklist in a file
 * whose job is HTTP; a table here means adding a task is one entry and the
 * route never changes.
 *
 * A name that is not in the table resolves to nothing, which is what makes the
 * route safe to hand a path segment straight from the browser.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorklistResult, WorklistTask } from '@/types/worklist';
import {
  changeRequests,
  ordersAwaitingPayment,
  overdueShipments,
  partPaidOrders,
  receiptsToVerify,
} from './worklist-order-tasks';
import {
  lowStockProducts,
  outOfStockProducts,
  reviewsToModerate,
  unansweredQuestions,
} from './worklist-catalog-tasks';

type Resolver = (supabase: SupabaseClient, limit: number) => Promise<WorklistResult>;

const RESOLVERS: Record<WorklistTask, Resolver> = {
  receipts: receiptsToVerify,
  'part-paid': partPaidOrders,
  'overdue-shipping': overdueShipments,
  'pending-orders': ordersAwaitingPayment,
  'change-requests': changeRequests,
  questions: unansweredQuestions,
  reviews: reviewsToModerate,
  'low-stock': lowStockProducts,
  'out-of-stock': outOfStockProducts,
};

/**
 * How many rows an expanded task shows.
 *
 * Six, because the panel is a worklist and not a table: enough to see the
 * shape of what is waiting — is this one big order or nineteen small ones —
 * and few enough that expanding two tasks still fits on a laptop screen.
 * Beyond that the row says how many more there are and links to the screen
 * that lists them all.
 */
export const WORKLIST_PAGE_SIZE = 6;

export function resolveWorklistTask(
  supabase: SupabaseClient,
  task: WorklistTask,
  limit: number = WORKLIST_PAGE_SIZE
): Promise<WorklistResult> {
  return RESOLVERS[task](supabase, limit);
}
