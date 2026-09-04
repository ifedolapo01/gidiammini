/**
 * The admin's only writable fields on a category. The rules matter because the
 * two columns they map to carry CHECK constraints, and because an empty string
 * has to reach the database as NULL — the storefront falls back to `name` on
 * NULL and would render a blank nav link on ''.
 */
import { describe, it, expect } from 'vitest';
import { parseCategoryEdit, CATEGORY_LIMITS } from './category-edit';

describe('parseCategoryEdit', () => {
  it('accepts either field on its own', () => {
    expect(parseCategoryEdit({ display_name: 'Big Kids' })).toEqual({
      ok: true,
      update: { display_name: 'Big Kids' },
    });
    expect(parseCategoryEdit({ size_guidance: 'Runs long.' })).toEqual({
      ok: true,
      update: { size_guidance: 'Runs long.' },
    });
  });

  it('leaves a field the request did not mention out of the update', () => {
    const result = parseCategoryEdit({ display_name: 'Big Kids' });
    expect(result.ok && 'size_guidance' in result.update).toBe(false);
  });

  it('turns an empty or blank value into null', () => {
    expect(parseCategoryEdit({ display_name: '' })).toEqual({
      ok: true,
      update: { display_name: null },
    });
    expect(parseCategoryEdit({ size_guidance: '   ' })).toEqual({
      ok: true,
      update: { size_guidance: null },
    });
  });

  it('trims what it keeps', () => {
    expect(parseCategoryEdit({ display_name: '  Big Kids  ' })).toEqual({
      ok: true,
      update: { display_name: 'Big Kids' },
    });
  });

  it('rejects a non-string', () => {
    expect(parseCategoryEdit({ display_name: 12 })).toEqual({
      ok: false,
      error: 'Storefront name must be text',
    });
  });

  it('rejects a value past the column CHECK', () => {
    const tooLong = 'x'.repeat(CATEGORY_LIMITS.display_name + 1);
    expect(parseCategoryEdit({ display_name: tooLong })).toEqual({
      ok: false,
      error: 'Storefront name must be 100 characters or fewer',
    });
  });

  it('rejects a request that changes nothing', () => {
    // A PATCH with only an id would otherwise write an empty update and
    // report success.
    expect(parseCategoryEdit({})).toEqual({ ok: false, error: 'Nothing to update' });
  });

  it('ignores anything else in the body', () => {
    expect(parseCategoryEdit({ display_name: 'Big Kids', slug: 'hacked', name: 'hacked' })).toEqual({
      ok: true,
      update: { display_name: 'Big Kids' },
    });
  });
});
