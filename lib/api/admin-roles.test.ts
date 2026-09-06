import { describe, it, expect } from 'vitest';
import {
  ADMIN_ROLES, ADMIN_ROLE_INFO, ROLE_PERMISSIONS, DEFAULT_ADMIN_ROLE,
  can, isAdminRole, roleLabel,
} from './admin-roles';

describe('the role vocabulary', () => {
  it('describes every role it defines', () => {
    // A role with no description reaches the invite screen as a bare name, and
    // a role picked from its name alone is how somebody ends up with more
    // access than anyone intended.
    expect(ADMIN_ROLE_INFO.map((info) => info.value).sort()).toEqual([...ADMIN_ROLES].sort());
    for (const info of ADMIN_ROLE_INFO) {
      expect(info.description.length, info.value).toBeGreaterThan(20);
    }
  });

  it('defaults to the least privileged role', () => {
    // What an unrecognised role is treated as, and what the invite form opens
    // on. Both must fail towards less access, never more.
    expect(ROLE_PERMISSIONS[DEFAULT_ADMIN_ROLE].length).toBe(
      Math.min(...ADMIN_ROLES.map((role) => ROLE_PERMISSIONS[role].length))
    );
  });
});

describe('can', () => {
  it('gives an owner everything and only an owner the team', () => {
    expect(can('owner', 'team:manage')).toBe(true);
    // Where the shop's money is sent stays with the owner, alongside who the
    // admins are.
    expect(can('owner', 'settings:write')).toBe(true);
    expect(can('manager', 'settings:write')).toBe(false);
    expect(can('fulfilment', 'settings:write')).toBe(false);
    expect(can('read_only', 'settings:write')).toBe(false);
    // Reading them is not restricted: half the Admin has to agree with the
    // storefront about the tax rate.
    expect(can('manager', 'store:read')).toBe(true);
    expect(can('manager', 'team:manage')).toBe(false);
    expect(can('fulfilment', 'team:manage')).toBe(false);
    expect(can('read_only', 'team:manage')).toBe(false);
  });

  it('lets fulfilment work orders and stock, and nothing else', () => {
    // The whole point of the role: a warehouse assistant who can adjust a
    // count without also being able to delete the product, change its price,
    // or read the customer database.
    expect(can('fulfilment', 'orders:write')).toBe(true);
    expect(can('fulfilment', 'stock:write')).toBe(true);
    expect(can('fulfilment', 'catalog:write')).toBe(false);
    expect(can('fulfilment', 'customers:read')).toBe(false);
    expect(can('fulfilment', 'audit:read')).toBe(false);
    expect(can('fulfilment', 'export:read')).toBe(false);
  });

  it('lets read-only change nothing at all', () => {
    const writes = ['catalog:write', 'stock:write', 'orders:write', 'customers:write', 'moderation:write', 'team:manage', 'settings:write'] as const;
    for (const permission of writes) {
      expect(can('read_only', permission), permission).toBe(false);
    }
    expect(can('read_only', 'store:read')).toBe(true);
  });

  it('keeps the audit trail and the customer list away from the narrower roles', () => {
    // Both carry more personal data than looking at the shop requires.
    for (const role of ['fulfilment', 'read_only'] as const) {
      expect(can(role, 'audit:read'), role).toBe(false);
      expect(can(role, 'customers:read'), role).toBe(false);
    }
  });

  it('grants nothing for a role it does not recognise', () => {
    // A row holding a role from a newer deployment, or from a migration that
    // has not run here. Fails closed rather than open.
    expect(can('superuser', 'store:read')).toBe(false);
    expect(can('staff', 'store:read')).toBe(false);
    expect(can(null, 'store:read')).toBe(false);
    expect(can(undefined, 'store:read')).toBe(false);
    expect(can('', 'store:read')).toBe(false);
  });
});

describe('isAdminRole and roleLabel', () => {
  it('accepts only the defined roles', () => {
    expect(isAdminRole('manager')).toBe(true);
    expect(isAdminRole('staff')).toBe(false);
    expect(isAdminRole(42)).toBe(false);
  });

  it('never renders an empty label', () => {
    expect(roleLabel('fulfilment')).toBe('Fulfilment');
    expect(roleLabel('staff')).toBe('staff');
    expect(roleLabel(null)).toBe('Unknown');
  });
});
