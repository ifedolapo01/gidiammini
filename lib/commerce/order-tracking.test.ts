import { describe, expect, it } from 'vitest';
import {
  CARRIERS,
  buildTrackingUrl,
  carrierName,
  carrierNeedsNumber,
  describeTracking,
  hasTracking,
  normaliseTrackingNumber,
  resolveTrackingFields,
  sanitiseTrackingUrl,
} from './order-tracking';

describe('the carrier list', () => {
  it('has unique keys, so a stored value resolves to one courier', () => {
    const keys = CARRIERS.map((carrier) => carrier.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only offers a URL template where it has a {{number}} placeholder to fill', () => {
    for (const carrier of CARRIERS) {
      if (carrier.urlTemplate) {
        expect(carrier.urlTemplate, carrier.key).toContain('{{number}}');
        expect(carrier.urlTemplate, carrier.key).toMatch(/^https:\/\//);
      }
    }
  });
});

describe('normaliseTrackingNumber', () => {
  it('uppercases and strips the separators couriers print for legibility', () => {
    expect(normaliseTrackingNumber(' gig-447 18_29 ')).toBe('GIG4471829');
  });

  it('returns null for nothing, rather than an empty string', () => {
    expect(normaliseTrackingNumber('')).toBeNull();
    expect(normaliseTrackingNumber('   ')).toBeNull();
    expect(normaliseTrackingNumber(null)).toBeNull();
  });
});

describe('sanitiseTrackingUrl', () => {
  it('accepts http and https', () => {
    expect(sanitiseTrackingUrl('https://track.example/1')).toBe('https://track.example/1');
    expect(sanitiseTrackingUrl(' http://track.example/1 ')).toBe('http://track.example/1');
  });

  it('refuses anything that is not a web link', () => {
    // This value ends up as an href in a customer's inbox.
    expect(sanitiseTrackingUrl('javascript:alert(1)')).toBeNull();
    expect(sanitiseTrackingUrl('track.example/1')).toBeNull();
    expect(sanitiseTrackingUrl('data:text/html,<script>')).toBeNull();
  });
});

describe('buildTrackingUrl', () => {
  it('fills the template for a courier that has one', () => {
    expect(buildTrackingUrl('ups', '1Z999')).toBe('https://www.ups.com/track?tracknum=1Z999');
  });

  it('normalises the number before putting it in the link', () => {
    expect(buildTrackingUrl('ups', '1z-999')).toBe('https://www.ups.com/track?tracknum=1Z999');
  });

  it('returns null for a courier with no published format', () => {
    expect(buildTrackingUrl('gig', '4471829')).toBeNull();
  });

  it('returns null when there is no number to look up', () => {
    expect(buildTrackingUrl('ups', '')).toBeNull();
  });
});

describe('carrierName and carrierNeedsNumber', () => {
  it('names a known courier', () => {
    expect(carrierName('gig')).toBe('GIG Logistics');
  });

  it('falls back to the raw value, so a hand-typed courier still reads as itself', () => {
    expect(carrierName('Uncle Musa')).toBe('Uncle Musa');
  });

  it('is empty for no courier at all', () => {
    expect(carrierName(null)).toBe('');
  });

  it('knows the shop’s own rider issues no waybill', () => {
    expect(carrierNeedsNumber('self')).toBe(false);
    expect(carrierNeedsNumber('gig')).toBe(true);
    // An unknown courier is assumed to issue one — asking and getting nothing
    // is better than never asking.
    expect(carrierNeedsNumber('something-new')).toBe(true);
  });
});

describe('describeTracking', () => {
  it('joins the courier and the number when both are present', () => {
    expect(describeTracking({ carrier: 'gig', trackingNumber: 'X1' })).toBe('GIG Logistics — X1');
  });

  it('falls back to whichever half exists', () => {
    expect(describeTracking({ carrier: 'gig' })).toBe('GIG Logistics');
    expect(describeTracking({ trackingNumber: 'X1' })).toBe('X1');
  });

  it('is empty when there is nothing to say', () => {
    expect(describeTracking(null)).toBe('');
    expect(describeTracking({})).toBe('');
  });
});

describe('resolveTrackingFields', () => {
  it('generates the link from the template when none was pasted', () => {
    const result = resolveTrackingFields({ carrier: 'ups', trackingNumber: '1z999' });

    expect(result.trackingUrl).toBe('https://www.ups.com/track?tracknum=1Z999');
  });

  it('lets a pasted link win over the generated one', () => {
    // The operator pasted what the courier actually gave them, which this
    // function cannot know better than.
    const result = resolveTrackingFields({
      carrier: 'ups',
      trackingNumber: '1z999',
      trackingUrl: 'https://example.test/mine',
    });

    expect(result.trackingUrl).toBe('https://example.test/mine');
  });

  it('discards a pasted value that is not a web link, rather than storing it', () => {
    const result = resolveTrackingFields({ carrier: 'gig', trackingUrl: 'javascript:alert(1)' });

    expect(result.trackingUrl).toBeNull();
  });

  it('nulls every field for an empty submission', () => {
    expect(resolveTrackingFields({})).toEqual({
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
    });
  });
});

describe('hasTracking', () => {
  it('is true when any one field is filled', () => {
    expect(hasTracking({ carrier: 'gig' })).toBe(true);
    expect(hasTracking({ trackingNumber: 'X1' })).toBe(true);
    expect(hasTracking({ trackingUrl: 'https://x.test' })).toBe(true);
  });

  it('is false for nothing at all', () => {
    expect(hasTracking(null)).toBe(false);
    expect(hasTracking({ carrier: null, trackingNumber: null, trackingUrl: null })).toBe(false);
  });
});
