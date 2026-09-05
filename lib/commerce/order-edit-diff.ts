/**
 * COMMERCE layer — what changed between two versions of an order's lines.
 *
 * Pure, so it can be tested without a database, and separate from order-edit.ts
 * because "what did this edit do" is asked by three callers that otherwise
 * share nothing: the audit entry, the customer's email, and the toast the
 * admin sees. Each of them phrasing it for itself is how three descriptions of
 * one event end up disagreeing.
 *
 * LINE IDENTITY IS product + size + colour
 *
 * Not the row id: the edit replaces every row, so ids do not survive it, and a
 * diff keyed on them would report every edit as "removed everything, added
 * everything". Two lines that resolve to the same variant are folded together
 * first — one line of 3 and one of 2 is five units of the same thing, however
 * it got typed.
 */

export interface OrderLine {
  product_id?: string | null;
  product_name: string;
  price: number;
  quantity: number;
  size?: string | null;
  color?: string | null;
}

export type LineChangeKind = 'added' | 'removed' | 'quantity' | 'price';

export interface LineChange {
  kind: LineChangeKind;
  /** "Cotton Gown (0-3m / Red)" — what a person calls this line. */
  label: string;
  /** Absent for 'added'. */
  from?: number;
  /** Absent for 'removed'. */
  to?: number;
}

/** Stable key for one variant of one product. */
function lineKey(line: OrderLine): string {
  return [
    line.product_id ?? `name:${line.product_name.trim().toLowerCase()}`,
    line.size ?? '',
    line.color ?? '',
  ].join('|');
}

/** "Cotton Gown (0-3m / Red)", with the bracket omitted when there is nothing
 * to put in it. */
export function describeLine(line: OrderLine): string {
  const variant = [line.size, line.color].filter(Boolean).join(' / ');
  return variant ? `${line.product_name} (${variant})` : line.product_name;
}

/** Folds duplicate lines for one variant into a single entry. Quantities add;
 * the price of the last one wins, which is the same rule the recomputed
 * subtotal would apply anyway. */
function fold(lines: OrderLine[]): Map<string, OrderLine> {
  const folded = new Map<string, OrderLine>();

  for (const line of lines) {
    const key = lineKey(line);
    const existing = folded.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      existing.price = line.price;
    } else {
      folded.set(key, { ...line });
    }
  }

  return folded;
}

/**
 * Every difference between two sets of lines, in a stable order: removals
 * first, then additions, then changes to what stayed. Reading it top to bottom
 * describes the edit the way somebody would say it out loud.
 */
export function diffOrderLines(before: OrderLine[], after: OrderLine[]): LineChange[] {
  const from = fold(before);
  const to = fold(after);

  const removed: LineChange[] = [];
  const added: LineChange[] = [];
  const amended: LineChange[] = [];

  for (const [key, line] of from) {
    if (!to.has(key)) {
      removed.push({ kind: 'removed', label: describeLine(line), from: line.quantity });
    }
  }

  for (const [key, line] of to) {
    const previous = from.get(key);

    if (!previous) {
      added.push({ kind: 'added', label: describeLine(line), to: line.quantity });
      continue;
    }

    if (previous.quantity !== line.quantity) {
      amended.push({
        kind: 'quantity',
        label: describeLine(line),
        from: previous.quantity,
        to: line.quantity,
      });
    }

    if (previous.price !== line.price) {
      amended.push({
        kind: 'price',
        label: describeLine(line),
        from: previous.price,
        to: line.price,
      });
    }
  }

  return [...removed, ...added, ...amended];
}

/** One sentence per change, in plain words. Used verbatim in the customer's
 * email, so it says what happened and never why — the why is the admin's own
 * note, which travels separately. */
export function describeLineChange(change: LineChange): string {
  switch (change.kind) {
    case 'added':
      return `Added ${change.to} × ${change.label}`;
    case 'removed':
      return `Removed ${change.label}`;
    case 'quantity':
      return `${change.label}: quantity changed from ${change.from} to ${change.to}`;
    case 'price':
      return `${change.label}: price changed from ${change.from} to ${change.to}`;
  }
}

/** True when nothing about the lines actually moved — the caller then has an
 * edit that only touched the discount, or no edit at all. */
export function isEmptyLineDiff(changes: LineChange[]): boolean {
  return changes.length === 0;
}
