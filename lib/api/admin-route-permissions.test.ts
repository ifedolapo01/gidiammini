import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { permissionForRequest } from './admin-route-permissions';
import { can } from './admin-roles';

describe('permissionForRequest', () => {
  it('separates reading the shop from changing it', () => {
    expect(permissionForRequest('GET', '/api/admin/products')).toEqual({
      permission: 'store:read', listed: true,
    });
    expect(permissionForRequest('DELETE', '/api/admin/products')).toEqual({
      permission: 'catalog:write', listed: true,
    });
  });

  it('carves stock out of the products tree', () => {
    // The reason the matcher scores specificity rather than taking the first
    // match: /api/admin/products/* would otherwise swallow the stock endpoint
    // and hand a warehouse assistant the ability to delete products.
    const uuid = '3f1b9c22-0000-4000-8000-000000000000';

    expect(permissionForRequest('PUT', `/api/admin/products/${uuid}/stock`)).toEqual({
      permission: 'stock:write', listed: true,
    });
    expect(permissionForRequest('PUT', `/api/admin/products/${uuid}`)).toEqual({
      permission: 'catalog:write', listed: true,
    });

    expect(can('fulfilment', 'stock:write')).toBe(true);
    expect(can('fulfilment', 'catalog:write')).toBe(false);
  });

  it('does not let a literal path be captured by a wildcard', () => {
    // /api/admin/products/import is a catalogue write, not "one product".
    expect(permissionForRequest('POST', '/api/admin/products/import')).toEqual({
      permission: 'catalog:write', listed: true,
    });
    expect(permissionForRequest('GET', '/api/admin/products/catalog')).toEqual({
      permission: 'store:read', listed: true,
    });
  });

  it('governs the order routes that do not sit under /api/admin', () => {
    const uuid = '3f1b9c22-0000-4000-8000-000000000000';

    expect(permissionForRequest('GET', '/api/orders')).toEqual({
      permission: 'orders:read', listed: true,
    });
    expect(permissionForRequest('PUT', `/api/orders/${uuid}`)).toEqual({
      permission: 'orders:write', listed: true,
    });
    expect(permissionForRequest('PUT', `/api/orders/${uuid}/shipping`)).toEqual({
      permission: 'orders:write', listed: true,
    });
  });

  it('keeps the customer database behind its own permission', () => {
    // An order carries the address it is being delivered to; the customer
    // directory carries every address anyone ever used. Fulfilment gets the
    // first and not the second.
    expect(permissionForRequest('GET', '/api/admin/customers')).toEqual({
      permission: 'customers:read', listed: true,
    });
    expect(can('fulfilment', 'orders:read')).toBe(true);
    expect(can('fulfilment', 'customers:read')).toBe(false);
  });

  it('treats trailing slashes as the same route', () => {
    expect(permissionForRequest('GET', '/api/admin/audit-log/')).toEqual({
      permission: 'audit:read', listed: true,
    });
  });

  it('refuses an endpoint nobody listed', () => {
    // Fail closed. A missing entry means somebody added a route without
    // thinking about permissions, and assuming "harmless" is how a permission
    // model quietly stops meaning anything.
    const write = permissionForRequest('POST', '/api/admin/something-new');
    expect(write.listed).toBe(false);
    expect(can('manager', write.permission)).toBe(false);
    expect(can('owner', write.permission)).toBe(true);

    const read = permissionForRequest('GET', '/api/admin/something-new');
    expect(read.listed).toBe(false);
    expect(can('read_only', read.permission)).toBe(false);
    expect(can('owner', read.permission)).toBe(true);
  });

  it('does not let a write inherit a read-only route permission', () => {
    // /api/admin/dashboard has no write entry. A POST added to it tomorrow
    // must not quietly acquire everyone-can-read access.
    const result = permissionForRequest('POST', '/api/admin/dashboard');
    expect(result.listed).toBe(false);
    expect(can('read_only', result.permission)).toBe(false);
    expect(can('manager', result.permission)).toBe(false);
  });
});

/**
 * The table only governs what it knows about, so this walks the real route
 * files and insists every admin endpoint is in it.
 *
 * Without this, the guarantee "adding an endpoint governs it automatically"
 * holds only until somebody adds one — and the failure is silent in
 * development, where the author is usually an owner and everything works.
 */
describe('every admin route is listed', () => {
  /** app/api/admin/products/[id]/stock/route.ts -> /api/admin/products/<id>/stock */
  function routePathFor(file: string): string {
    return (
      '/' +
      file
        // readdir and join hand back the platform separator, so the path is
        // split on that rather than on a literal that only holds on one OS.
        .split(sep)
        .join('/')
        .replace(/^app[/]/, '')
        .replace(/[/]route[.]ts$/, '')
        .split('/')
        .map((segment) => (segment.startsWith('[') ? '*' : segment))
        .join('/')
    );
  }

  function adminRouteFiles(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        adminRouteFiles(full, found);
      } else if (entry.name === 'route.ts' && readFileSync(full, 'utf8').includes('withAdminAuth(')) {
        found.push(full);
      }
    }
    return found;
  }

  const files = adminRouteFiles('app/api');

  it('finds the routes to check', () => {
    // A refactor that moved them all would otherwise make this suite pass by
    // checking nothing.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    const path = routePathFor(file);

    // An explicit `permission:` on the wrapper is the sanctioned way out for a
    // route whose path does not describe what it touches.
    if (/withAdminAuth\([\s\S]*permission:/.test(source)) return;

    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const exported = new RegExp(`export const ${method}\s*=\s*withAdminAuth`).test(source);
      if (!exported) continue;

      expect(permissionForRequest(method, path), `${method} ${path}`).toMatchObject({ listed: true });
    }
  });
});
