/**
 * ADMIN layer — the things the alert ticker can say, one source each.
 *
 * Extracted from useAdminAlerts, which had grown to six copies of the same
 * shape — fetch an endpoint, read a count, push a sentence — in one 200-line
 * effect. Four of those six differ only in the URL, the field and the wording,
 * so they are declarations against `counted()`; the two that genuinely differ
 * (one endpoint answering with two alerts, and the ambient store facts) stay
 * written out.
 *
 * Two rules every source follows:
 *
 *   1. It answers with an empty list, never an error. A ticker is an
 *      awareness surface; one endpoint being down must not blank the other
 *      five, which is what the single try/catch around the old sequential
 *      version did.
 *   2. It says the number and where to go. An alert with no link is a
 *      statement the reader cannot act on.
 */
import { counted, id, plural, read, type AlertItem, type AlertSource } from './alert-item';

/** Nothing to sell is the most urgent thing this bar can say. Bespoke, because
 *  it is the one endpoint that answers with two different alerts. */
const stockAlerts: AlertSource = async () => {
  const data = await read('/api/admin/products/negative-stock');
  if (!data) return [];

  const alerts: AlertItem[] = [];

  if (data.outOfStockCount > 0) {
    alerts.push({
      id: id('out-of-stock'),
      type: 'out-of-stock',
      message: `🚨 ${data.outOfStockCount} product${plural(data.outOfStockCount, ' is', 's are')} OUT OF STOCK`,
      link: '/admin/stock',
      tone: 'destructive',
      count: data.outOfStockCount,
      priority: 1,
    });
  }

  if (data.lowStockCount > 0) {
    alerts.push({
      id: id('low-stock'),
      type: 'low-stock',
      message: `⚠️ ${data.lowStockCount} product${plural(data.lowStockCount, ' is', 's are')} running LOW on stock (5 or less)`,
      link: '/admin/stock',
      tone: 'warning',
      count: data.lowStockCount,
      priority: 2,
    });
  }

  return alerts;
};

/** Not alerts so much as ambient facts, which is why they sort last. */
const storeStats: AlertSource = async () => {
  const data = await read('/api/admin/alerts/dashboard-stats');
  if (!data?.success || !data.stats) return [];

  const stats = data.stats;
  const alerts: AlertItem[] = [];

  if (stats.todayOrders > 0) {
    alerts.push({
      id: id('today-orders'),
      type: 'system',
      message: `📊 ${stats.todayOrders} order${stats.todayOrders > 1 ? 's' : ''} placed today`,
      link: '/admin/orders',
      tone: 'accent',
      count: stats.todayOrders,
      priority: 6,
    });
  }

  // Add total products alert (once a day maybe)
  const shouldShowTotalProducts = Math.random() > 0.7; // 30% chance
  if (shouldShowTotalProducts && stats.totalProducts > 0) {
    alerts.push({
      id: id('total-products'),
      type: 'system',
      message: `📦 ${stats.totalProducts} active products in store`,
      link: '/admin/products',
      tone: 'info',
      count: stats.totalProducts,
      priority: 7,
    });
  }

  return alerts;
};

export const ALERT_SOURCES: AlertSource[] = [
  stockAlerts,

  // Confirmed orders past their zone's ETA window.
  counted({
    type: 'overdue-shipping',
    url: '/api/admin/alerts/overdue-shipments',
    field: 'overdueCount',
    link: '/admin/orders?filter=overdue',
    tone: 'destructive',
    priority: 2,
    message: (count) =>
      `🚚 ${count} confirmed order${plural(count, ' is', 's are')} PAST their shipping window - update status`,
  }),

  counted({
    type: 'pending-orders',
    url: '/api/admin/alerts/pending-orders',
    field: 'pendingCount',
    link: '/admin/orders',
    tone: 'warning',
    priority: 4,
    message: (count) => `📦 ${count} order${plural(count, ' is', 's are')} PENDING confirmation`,
  }),

  counted({
    type: 'pending-change-requests',
    url: '/api/admin/alerts/pending-change-requests',
    field: 'pendingCount',
    link: '/admin/orders',
    tone: 'warning',
    priority: 5,
    message: (count) =>
      `🔄 ${count} order change request${plural(count, ' is', 's are')} awaiting review`,
  }),

  /**
   * Reviews waiting to be published.
   *
   * On the bar because an unpublished review is invisible to shoppers: a
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
    message: (count) =>
      `❓ ${count} product question${plural(count, ' is', 's are')} waiting for an answer`,
  }),

  storeStats,
];
