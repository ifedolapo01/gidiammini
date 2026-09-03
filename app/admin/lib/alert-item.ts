/**
 * ADMIN layer — what an operational alert is, and the kit for building one.
 *
 * Split from alert-sources.ts so the vocabulary is not declared inside a file
 * full of fetches: the ticker and the pill need the types and nothing else,
 * and a source needs `counted()` and the two formatters. Four of the six
 * sources are one endpoint, one count and one sentence, which is exactly what
 * `counted()` expresses — the repetition it replaces was the reason this file
 * had drifted over 200 lines.
 */

export type AlertTone = 'destructive' | 'warning' | 'info' | 'accent';

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
    | 'system'
    | 'low-stock';
  message: string;
  link: string;
  tone: AlertTone;
  count?: number;
  /** Lowest number shows first. 1 is "a customer cannot buy something". */
  priority: number;
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

/** The shape four sources share: one endpoint, one count, one sentence. */
export function counted(config: {
  type: AlertItem['type'];
  url: string;
  /** The count's field in the response body. */
  field: string;
  link: string;
  tone: AlertTone;
  priority: number;
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
      },
    ];
  };
}
