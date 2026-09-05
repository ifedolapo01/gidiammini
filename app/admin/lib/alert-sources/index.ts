/**
 * ADMIN layer — the things the worklist can say, one source each.
 *
 * Extracted from useAdminAlerts, which had grown to six copies of the same
 * shape — fetch an endpoint, read a count, push a sentence — in one 200-line
 * effect. Most sources differ only in the URL, the field and the wording, so
 * they are declarations against `counted()` and live here; the three that
 * genuinely differ (two endpoints answering with two alerts each, and the
 * ambient store facts) are hand-written in their own files beside this one.
 *
 * Three rules every source follows:
 *
 *   1. It answers with an empty list, never an error. This is an awareness
 *      surface; one endpoint being down must not blank the other five, which
 *      is what the single try/catch around the old sequential version did.
 *   2. It says the number and where to go. An alert with no link is a
 *      statement the reader cannot act on.
 *   3. It names its group and, where the count is made of workable items, its
 *      worklist task. Without a task a row cannot be expanded into the
 *      specific orders behind it, which is the difference between announcing
 *      work and offering it.
 */
import { counted, plural, type AlertSource } from '../alert-item';
import { paymentAlerts } from './payment-sources';
import { stockAlerts } from './stock-sources';
import { storeStats } from './store-sources';

export const ALERT_SOURCES: AlertSource[] = [
  // Money first. See payment-sources.ts for why.
  paymentAlerts,
  stockAlerts,

  // Confirmed orders past their zone's ETA window.
  //
  // The wording here, and in the sources beside it, was written for a ticker:
  // four seconds on screen meant shouting in capitals to be read at all. In a
  // list somebody scans, capitals are just harder to read, and the badge
  // already carries the urgency.
  counted({
    type: 'overdue-shipping',
    url: '/api/admin/alerts/overdue-shipments',
    field: 'overdueCount',
    link: '/admin/orders?filter=overdue',
    tone: 'destructive',
    priority: 2,
    group: 'fulfilment',
    task: 'overdue-shipping',
    message: (count) =>
      `🚚 ${count} confirmed order${plural(count, ' is', 's are')} past their delivery window`,
  }),

  /**
   * Orders placed with no receipt uploaded yet.
   *
   * Reads awaitingReceiptCount, not pendingCount, and that is deliberate: a
   * pending order that HAS a receipt is already counted by the receipts row
   * above. Counting every pending order here would double-count those, and
   * expanding the row would list fewer items than the badge claims — which is
   * how a number stops being believed.
   *
   * These are customers to nudge rather than receipts to check, which is why
   * they sit in fulfilment rather than under money.
   */
  counted({
    type: 'pending-orders',
    url: '/api/admin/alerts/pending-orders',
    field: 'awaitingReceiptCount',
    link: '/admin/orders',
    tone: 'warning',
    priority: 4,
    group: 'fulfilment',
    task: 'pending-orders',
    message: (count) =>
      `📦 ${count} order${plural(count, ' is', 's are')} still waiting on a payment receipt`,
  }),

  counted({
    type: 'pending-change-requests',
    url: '/api/admin/alerts/pending-change-requests',
    field: 'pendingCount',
    link: '/admin/orders',
    tone: 'warning',
    priority: 5,
    group: 'customers',
    task: 'change-requests',
    message: (count) =>
      `🔄 ${count} order change request${plural(count, ' is', 's are')} awaiting review`,
  }),

  /**
   * Reviews waiting to be published.
   *
   * On the list because an unpublished review is invisible to shoppers: a
   * customer took the trouble to write one, and until somebody clicks publish
   * it does nothing for the product page it was written about. Same priority
   * as change requests — both are "a person is waiting on you", neither stops
   * anyone buying.
   */
  counted({
    type: 'pending-reviews',
    url: '/api/admin/alerts/pending-reviews',
    field: 'pendingCount',
    link: '/admin/reviews',
    tone: 'info',
    priority: 5,
    group: 'customers',
    task: 'reviews',
    message: (count) => `⭐ ${count} review${plural(count, ' is', 's are')} waiting to be published`,
  }),

  /**
   * Questions with no answer yet.
   *
   * A warning rather than info, and above the review count: an unanswered
   * question is a shopper who has said out loud that something is stopping
   * them buying. A pending review is somebody being generous; this is somebody
   * waiting.
   */
  counted({
    type: 'pending-questions',
    url: '/api/admin/alerts/pending-questions',
    field: 'pendingCount',
    link: '/admin/questions',
    tone: 'warning',
    priority: 3,
    group: 'customers',
    task: 'questions',
    message: (count) =>
      `❓ ${count} product question${plural(count, ' is', 's are')} waiting for an answer`,
  }),

  storeStats,
];
