import { describe, expect, it } from 'vitest';
import { countWorkItems, groupAlerts } from './alert-groups';
import type { AlertItem } from './alert-item';

function alert(overrides: Partial<AlertItem> & Pick<AlertItem, 'group' | 'priority'>): AlertItem {
  return {
    id: `${overrides.group}-${overrides.priority}`,
    type: 'system',
    message: 'something',
    link: '/admin/dashboard',
    tone: 'info',
    ...overrides,
  };
}

describe('groupAlerts', () => {
  it('drops groups with nothing in them', () => {
    const groups = groupAlerts([alert({ group: 'money', priority: 1, task: 'receipts', count: 3 })]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('money');
  });

  it('orders groups by their most urgent member', () => {
    const groups = groupAlerts([
      alert({ group: 'customers', priority: 5, task: 'questions', count: 2 }),
      alert({ group: 'fulfilment', priority: 2, task: 'overdue-shipping', count: 1 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['fulfilment', 'customers']);
  });

  it('breaks a priority tie on the declared order, money first', () => {
    const groups = groupAlerts([
      alert({ group: 'inventory', priority: 1, task: 'out-of-stock', count: 1 }),
      alert({ group: 'money', priority: 1, task: 'receipts', count: 1 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['money', 'inventory']);
  });

  it('orders items inside a group by priority', () => {
    const groups = groupAlerts([
      alert({ id: 'a', group: 'money', priority: 2, task: 'part-paid', count: 1 }),
      alert({ id: 'b', group: 'money', priority: 1, task: 'receipts', count: 1 }),
    ]);

    expect(groups[0].items.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('totals the counts, not the rows', () => {
    const groups = groupAlerts([
      alert({ id: 'a', group: 'money', priority: 1, task: 'receipts', count: 4 }),
      alert({ id: 'b', group: 'money', priority: 2, task: 'part-paid', count: 3 }),
    ]);

    expect(groups[0].total).toBe(7);
  });

  it('counts a countless item as one thing to do', () => {
    const groups = groupAlerts([alert({ group: 'money', priority: 1, task: 'receipts' })]);

    expect(groups[0].total).toBe(1);
  });

  it('marks a group with no workable items as ambient', () => {
    const groups = groupAlerts([
      alert({ group: 'store', priority: 6, count: 12 }),
      alert({ id: 'work', group: 'money', priority: 1, task: 'receipts', count: 1 }),
    ]);

    expect(groups.find((group) => group.key === 'store')?.ambient).toBe(true);
    expect(groups.find((group) => group.key === 'money')?.ambient).toBe(false);
  });
});

describe('countWorkItems', () => {
  it('ignores ambient facts', () => {
    const total = countWorkItems([
      alert({ id: 'a', group: 'money', priority: 1, task: 'receipts', count: 4 }),
      alert({ id: 'b', group: 'store', priority: 6, count: 212 }),
    ]);

    expect(total).toBe(4);
  });
});
