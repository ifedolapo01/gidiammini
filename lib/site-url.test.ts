import { describe, expect, it } from 'vitest';
import { normalizeOrigin, absoluteUrl } from './site-url';

const ORIGIN = 'https://shop.example';

describe('normalizeOrigin / absoluteUrl', () => {
  it('strips trailing slashes and falls back on an empty value', () => {
    expect(normalizeOrigin('https://a.example/')).toBe('https://a.example');
    expect(normalizeOrigin('https://a.example///')).toBe('https://a.example');
    // An empty env var is a misconfiguration, not a request for a relative site.
    expect(normalizeOrigin('')).toBe('https://gidiammini.com');
    expect(normalizeOrigin(undefined)).toBe('https://gidiammini.com');
  });

  it('joins a path exactly once, whatever slashes it arrives with', () => {
    expect(absoluteUrl('/products', ORIGIN)).toBe('https://shop.example/products');
    expect(absoluteUrl('products', ORIGIN)).toBe('https://shop.example/products');
    expect(absoluteUrl('//products', ORIGIN)).toBe('https://products');
  });

  it('passes an already-absolute URL through — main_image is often a CDN URL', () => {
    expect(absoluteUrl('https://cdn.example/a.jpg', ORIGIN)).toBe('https://cdn.example/a.jpg');
  });
});
