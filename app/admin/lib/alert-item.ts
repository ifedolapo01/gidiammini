/**
 * ADMIN layer — what an operational alert is, and the kit for building one.
 *
 * Split from alert-sources.ts so the vocabulary is not declared inside a file
 * full of fetches: the worklist, the ticker and the pill need the types and
 * nothing else, and a source needs `counted()` and the two formatters. Most of
 * the sources are one endpoint, one count and one sentence, which is exactly
 * what `counted()` expresses — the repetition it replaces was the reason this
 * file had drifted over 200 lines.
 *
 * TWO SURFACES, ONE VOCABULARY
 *
 * These items started life as ticker copy: one sentence, shown for four
 * seconds, in rotation. They are now primarily rows in a persistent worklist
 * on the dashboard, which needs two things a ticker did not — a `group`, so
 * related work sits together, and a `task`, so a row can be expanded into the
 * specific orders it is made of. The ticker still renders the same items on
 * every other page, as a secondary indicator.
 */
import type { WorklistTask } from '@/types/worklist';

export type AlertTone = 'destructive' | 'warning' | 'info' | 'accent';

/**
 * Which part of running the shop an item belongs to.
 *
 * The worklist is grouped by this rather than by tone or by source, because a
 * morning is spent one concern at a time: the money, then the orders going
 * out, then the people waiting on a reply. A flat list sorted by urgency
 * alone interleaves them and makes every row a context switch.
 */
export type AlertGroup = 'money' | 'fulfilment' | 'customers' | 'inventory' | 'store';

export interface AlertItem {
  id: string;
  type:
    | 'stock'
    | 'out-of-stock'
    | 'overdue-shipping'
    | 'pending-orders'
    | 'pending-change-requests'
    | 'pending-reviews'
    | 'pending-questions'
    | 'payment-verification'
    | 'part-paid'
    | 'system'
    | 'low-stock';
  message: string;
  link: string;
  tone: AlertTone;
  count?: number;
  /** Lowest number shows first. 1 is "money is unaccounted for, or a customer
   *  cannot buy something". */
  priority: number;
  /** See AlertGroup. */
  group: AlertGroup;
  /**
   * The worklist task behind this count, where there is one.
   *
   * Its presence is what makes a row expandable: with it, the panel can ask
   * /api/admin/worklist/<task> for the specific items. Ambient facts ("212
   * active products") have no task, because there is nothing to work.
   */
  task?: WorklistTask;
}

export type AlertSource = () => Promise<AlertItem[]>;

/** A GET that yields null rather than throwing — see rule 1. */
export async function read(url: string): Promise<any | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Alert source ${url} failed:`, error);
    return null;
  }
}

/** Distinct per refresh, which is what lets a dismissed alert come back. */
export const id = (key: string) => `${key}-${Date.now()}`;

export const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

/** The shape most sources share: one endpoint, one count, one sentence. */
export function counted(config: {
  type: AlertItem['type'];
  url: string;
  /** The count's field in the response body. */
  field: string;
  link: string;
  tone: AlertTone;
  priority: number;
  group: AlertGroup;
  task?: WorklistTask;
  message: (count: number) => string;
}): AlertSource {
  return async () => {
    const data = await read(config.url);
    const count = Number(data?.[config.field] ?? 0);
    if (!count) return [];

    return [
      {
        id: id(config.type),
        type: config.type,
        message: config.message(count),
        link: config.link,
        tone: config.tone,
        count,
        priority: config.priority,
        group: config.group,
        task: config.task,
      },
    ];
  };
}
