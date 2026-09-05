/**
 * ADMIN layer — turning a flat list of alerts into a worklist.
 *
 * Pure, and separate from both the hook that fetches and the components that
 * render, because grouping is the actual idea in the "Today" panel and it is
 * worth being able to reason about on its own.
 *
 * WHAT ORDERING MEANS HERE
 *
 * Within a group, items sort by AlertItem.priority — the field that has always
 * been on them and was previously only used to decide what a ticker showed
 * first. Groups sort by their most urgent member, so a group containing a
 * priority-1 item comes before one whose best is a 3; ties fall back to the
 * declared order below, which is roughly the order a shopkeeper works in.
 * Nothing is sorted by tone: colour describes an item, it does not rank it.
 */
import type { AlertGroup, AlertItem } from './alert-item';

export interface AlertGroupInfo {
  key: AlertGroup;
  /** The heading. Written as the concern, not as the data source. */
  label: string;
  /** One line under the heading when the group has something in it. */
  hint: string;
}

/**
 * Declared order, used only to break a tie between two groups whose most
 * urgent item has the same priority. Money first because it is the job that
 * comes back several times a day and the one customers are actively waiting
 * on.
 */
export const ALERT_GROUPS: readonly AlertGroupInfo[] = [
  { key: 'money', label: 'Money to confirm', hint: 'Customers who have paid and are waiting on you.' },
  { key: 'fulfilment', label: 'Orders to move', hint: 'Orders that should have gone out, or gone further.' },
  { key: 'customers', label: 'People waiting', hint: 'Someone asked you something and has had no reply.' },
  { key: 'inventory', label: 'Stock', hint: 'What you cannot sell, and what you are about to run out of.' },
  { key: 'store', label: 'Today at a glance', hint: 'Nothing to do here — just where the shop stands.' },
];

export interface AlertGroupBucket extends AlertGroupInfo {
  items: AlertItem[];
  /** Items in this group, summed. What the group's badge shows. */
  total: number;
  /** The group's most urgent member, for ordering. */
  topPriority: number;
  /** True when nothing in the group is work — the ambient facts. */
  ambient: boolean;
}

const DECLARED_ORDER = new Map(ALERT_GROUPS.map((group, index) => [group.key, index]));

/**
 * The worklist: groups that have something in them, most urgent first.
 *
 * Empty groups are dropped rather than shown as zeroes. A panel of "0 receipts
 * to verify, 0 orders overdue" is a panel nobody reads, and the absence of a
 * group is already the message.
 */
export function groupAlerts(alerts: AlertItem[]): AlertGroupBucket[] {
  return ALERT_GROUPS.map((group): AlertGroupBucket => {
    const items = alerts
      .filter((alert) => alert.group === group.key)
      .sort((a, b) => a.priority - b.priority);

    return {
      ...group,
      items,
      // Falls back to 1 per item for an alert that carries no count, so a
      // countless item still registers as one thing to do.
      total: items.reduce((sum, item) => sum + (item.count ?? 1), 0),
      topPriority: items.length > 0 ? items[0].priority : Number.POSITIVE_INFINITY,
      ambient: items.every((item) => !item.task),
    };
  })
    .filter((group) => group.items.length > 0)
    .sort(
      (a, b) =>
        a.topPriority - b.topPriority ||
        (DECLARED_ORDER.get(a.key) ?? 0) - (DECLARED_ORDER.get(b.key) ?? 0)
    );
}

/** Everything that is actually work, for the panel's own headline count. */
export function countWorkItems(alerts: AlertItem[]): number {
  return alerts
    .filter((alert) => alert.task)
    .reduce((sum, alert) => sum + (alert.count ?? 1), 0);
}
