import { describe, expect, it, vi } from 'vitest';
import { formatDate, shortUrlForCode } from './utils';

describe('utils', () => {
  it('formats dates using numeric year month and day', () => {
    expect(formatDate('2026-05-19T00:00:00.000Z')).toMatch(/^2026\/5\/19$/);
  });

  it('builds public short URLs with the /url-shortener/r prefix', () => {
    vi.stubGlobal('location', { origin: 'https://example.test' });

    expect(shortUrlForCode('abc123')).toBe('https://example.test/url-shortener/r/abc123');

    vi.unstubAllGlobals();
  });
});
