import { describe, it, expect } from 'vitest';
import { localFaviconUrl } from '../src/lib/favicon';

describe('localFaviconUrl', () => {
  it("points at Chrome's local favicon cache, never the network", () => {
    const u = new URL(localFaviconUrl('https://github.com/acme/repo?x=1#y'));
    expect(u.protocol).toBe('chrome-extension:');
    expect(u.pathname).toBe('/_favicon/');
    expect(u.searchParams.get('pageUrl')).toBe('https://github.com/acme/repo?x=1#y');
    expect(u.searchParams.get('size')).toBe('32');
  });

  it('returns nothing for pages without a web favicon', () => {
    expect(localFaviconUrl('chrome://settings')).toBe('');
    expect(localFaviconUrl('about:blank')).toBe('');
    expect(localFaviconUrl('')).toBe('');
  });
});
