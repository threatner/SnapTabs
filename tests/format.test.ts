import { describe, it, expect } from 'vitest';
import { plural, relativeTime, formatBytes } from '@/lib/format';

describe('plural', () => {
  it('uses the singular only for 1', () => {
    expect(plural(1, 'tab')).toBe('1 tab');
    expect(plural(0, 'tab')).toBe('0 tabs');
    expect(plural(8, 'tab')).toBe('8 tabs');
    expect(plural(2, 'window')).toBe('2 windows');
  });
});

describe('relativeTime', () => {
  const now = new Date(2026, 10, 18, 12, 0, 0).getTime();
  const ago = (ms: number) => relativeTime(now - ms, now, 'en-US');
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('covers minutes, hours, yesterday and days', () => {
    expect(ago(10_000)).toBe('Just now');
    expect(ago(5 * MIN)).toBe('5m ago');
    expect(ago(3 * HOUR)).toBe('3h ago');
    expect(ago(DAY + HOUR)).toBe('Yesterday');
    expect(ago(4 * DAY)).toBe('4d ago');
  });

  it('shows a short date after a week, without the year this year', () => {
    expect(relativeTime(new Date(2026, 10, 4, 9).getTime(), now, 'en-US')).toBe('Nov 4');
  });

  it('adds the year for earlier years', () => {
    expect(relativeTime(new Date(2025, 11, 30, 9).getTime(), now, 'en-US')).toBe('Dec 30, 2025');
  });
});

describe('formatBytes', () => {
  it('formats B, KB and MB without a trailing .0', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(11_469)).toBe('11.2 KB');
    expect(formatBytes(10_485_760)).toBe('10 MB');
    expect(formatBytes(3_565_158)).toBe('3.4 MB');
  });
});
