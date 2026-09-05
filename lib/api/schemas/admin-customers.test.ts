import { describe, expect, it } from 'vitest';
import { customerCampaignSchema, customerUpdateSchema } from './admin-customers';

const base = { is_blocked: false };

describe('customerUpdateSchema', () => {
  it('accepts the operational fields and nothing else', () => {
    const parsed = customerUpdateSchema.parse({
      ...base,
      notes: 'Prefers WhatsApp',
      // Identity is maintained from checkout; editing it here would detach the
      // record from the orders that resolve to it by email.
      email: 'someone-else@example.test',
      full_name: 'Not Their Name',
    }) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('email');
    expect(parsed).not.toHaveProperty('full_name');
    expect(parsed.notes).toBe('Prefers WhatsApp');
  });

  it('lower-cases and trims tags, so the value echoed back is the value stored', () => {
    const parsed = customerUpdateSchema.parse({ ...base, tags: ['  Wholesale ', 'VIP'] });

    expect(parsed.tags).toEqual(['wholesale', 'vip']);
  });

  it('accepts a multi-word tag', () => {
    expect(customerUpdateSchema.parse({ ...base, tags: ['repeat buyer'] }).tags).toEqual([
      'repeat buyer',
    ]);
  });

  it('refuses a tag with punctuation that would make it unsearchable', () => {
    expect(customerUpdateSchema.safeParse({ ...base, tags: ['vip!'] }).success).toBe(false);
    expect(customerUpdateSchema.safeParse({ ...base, tags: ['a,b'] }).success).toBe(false);
    expect(customerUpdateSchema.safeParse({ ...base, tags: [' '] }).success).toBe(false);
  });

  it('refuses a tag that starts with a separator', () => {
    expect(customerUpdateSchema.safeParse({ ...base, tags: ['-vip'] }).success).toBe(false);
  });

  it('keeps "tags not mentioned" distinct from "no tags"', () => {
    // Undefined leaves the existing set alone; an empty array clears it.
    expect(customerUpdateSchema.parse(base).tags).toBeUndefined();
    expect(customerUpdateSchema.parse({ ...base, tags: [] }).tags).toEqual([]);
  });

  it('caps how many tags one customer can carry', () => {
    const many = Array.from({ length: 21 }, (_, index) => `tag${index}`);

    expect(customerUpdateSchema.safeParse({ ...base, tags: many }).success).toBe(false);
  });

  it('requires the blocked flag to be a real boolean', () => {
    expect(customerUpdateSchema.safeParse({ is_blocked: 'yes' }).success).toBe(false);
  });
});

describe('customerCampaignSchema', () => {
  const valid = { tag: 'Wholesale', subject: 'New stock', message: 'We have restocked.' };

  it('lower-cases the tag so it matches how tags are stored', () => {
    expect(customerCampaignSchema.parse(valid).tag).toBe('wholesale');
  });

  it('does not send unless the caller explicitly confirms', () => {
    // The default is a dry run. An email to a segment cannot be recalled, and
    // the failure mode is a tag matching far more people than intended.
    expect(customerCampaignSchema.parse(valid).confirm).toBe(false);
    expect(customerCampaignSchema.parse({ ...valid, confirm: true }).confirm).toBe(true);
  });

  it('refuses a truthy-looking string rather than reading it as consent', () => {
    // The one field that decides whether irreversible email goes out is not a
    // place to be lenient about types.
    expect(customerCampaignSchema.safeParse({ ...valid, confirm: 'true' }).success).toBe(false);
    expect(customerCampaignSchema.safeParse({ ...valid, confirm: 1 }).success).toBe(false);
  });

  it('requires a subject and a message', () => {
    expect(customerCampaignSchema.safeParse({ ...valid, subject: '   ' }).success).toBe(false);
    expect(customerCampaignSchema.safeParse({ ...valid, message: '' }).success).toBe(false);
  });

  it('requires a tag — there is no "message everybody" through this route', () => {
    expect(customerCampaignSchema.safeParse({ ...valid, tag: '' }).success).toBe(false);
  });
});
