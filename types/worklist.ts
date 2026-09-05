// types/worklist.ts — the vocabulary the "Today" panel and its detail
// endpoint share.
//
// The panel groups and counts operational alerts; expanding a row asks for the
// things behind the count. Both halves have to agree on what a task is called
// and what a row of it looks like, and neither can import the other — the
// counts are gathered in the browser (app/admin/lib/alert-sources.ts) and the
// rows are resolved on the server (lib/commerce/worklist-*.ts).

/**
 * A kind of work the panel can expand.
 *
 * Named after the job rather than the table, because that is what the operator
 * is doing: 'receipts' is "look at the receipts", not "select from orders".
 */
export const WORKLIST_TASKS = [
  'receipts',
  'part-paid',
  'overdue-shipping',
  'pending-orders',
  'change-requests',
  'questions',
  'reviews',
  'low-stock',
  'out-of-stock',
] as const;

export type WorklistTask = (typeof WORKLIST_TASKS)[number];

export function isWorklistTask(value: unknown): value is WorklistTask {
  return typeof value === 'string' && (WORKLIST_TASKS as readonly string[]).includes(value);
}

/**
 * An inline action a row supports.
 *
 * Deliberately a very short list. An action belongs here only when it is
 * unambiguous from the row alone — "this confirmed order is four days past its
 * delivery window, mark it shipped" needs no form and no second thought.
 * Anything that needs a figure, a reason or a judgement is a link to the
 * screen built for it, because a half-form in a dashboard row is how the wrong
 * thing gets recorded.
 */
export type WorklistAction = 'ship';

export interface WorklistEntry {
  /** The entity's own id — an order, a product, a question. */
  id: string;
  /** The line somebody scans for: a customer's name, a product's name. */
  title: string;
  /** What it is: an order number, a category, a rating. */
  subtitle: string;
  /** Why it is urgent: "waiting 3 days", "8 hours past the window". */
  meta?: string | null;
  /** Naira, where the row is about money. */
  amount?: number | null;
  /** Where to go to work this item properly. */
  href: string;
  /** See WorklistAction. */
  action?: WorklistAction;
}

export interface WorklistResult {
  task: WorklistTask;
  entries: WorklistEntry[];
  /** True when there is more behind the list than was returned, so the panel
   *  can send the operator to the full screen instead of implying this is
   *  everything. */
  truncated: boolean;
}
