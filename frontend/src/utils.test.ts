import { describe, expect, it, vi } from 'vitest';
import { formatDate, shortUrlForCode } from './utils';

describe('utils', () => {
  it('formats dates with year month day and time', () => {
    expect(formatDate('2026-05-19T00:00:00.000Z')).toMatch(/^2026\/05\/19 \d{2}:\d{2}$/);
  });

  it('builds public short URLs with the /url-shortener/r prefix', () => {
    vi.stubGlobal('location', { origin: 'https://example.test' });

    expect(shortUrlForCode('abc123')).toBe('https://example.test/url-shortener/r/abc123');

    vi.unstubAllGlobals();
  });
});
