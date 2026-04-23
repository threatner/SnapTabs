import { describe, it, expect } from 'vitest';
import {
  formatSessionName,
  uuid,
  BLOCKED_URL_PREFIXES,
  DEFAULT_SETTINGS,
  TAB_GROUP_COLORS,
} from '../src/lib/types';

describe('uuid', () => {
  it('returns a valid v4 UUID format', () => {
    const id = uuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
  });
});

describe('formatSessionName', () => {
  it('includes the prefix', () => {
    const name = formatSessionName('Snapshot');
    expect(name).toContain('Snapshot');
  });

  it('includes a date/time string after the dash', () => {
    const name = formatSessionName('Recording');
    expect(name).toMatch(/^Recording - .+/);
  });

  it('includes month and time components', () => {
    const name = formatSessionName('Test');
    // Should contain a month abbreviation and time like "3:45 PM"
    expect(name).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?(AM|PM)/);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_SETTINGS.autoSnapshotOnClose).toBe(false);
    expect(DEFAULT_SETTINGS.autoSnapshotOnBrowserClose).toBe(false);
    expect(DEFAULT_SETTINGS.autoDeleteAfterRestore).toBe(false);
    expect(DEFAULT_SETTINGS.maxSessions).toBe(50);
    expect(DEFAULT_SETTINGS.showIncognitoWarning).toBe(true);
    expect(DEFAULT_SETTINGS.restoreIncognitoToIncognito).toBe(true);
    expect(DEFAULT_SETTINGS.restoreInNewWindow).toBe(false);
  });

  it('has all seven settings', () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(7);
  });
});

describe('BLOCKED_URL_PREFIXES', () => {
  it('contains chrome:// prefix', () => {
    expect(BLOCKED_URL_PREFIXES).toContain('chrome://');
  });

  it('contains chrome-extension:// prefix', () => {
    expect(BLOCKED_URL_PREFIXES).toContain('chrome-extension://');
  });

  it('contains about: prefix', () => {
    expect(BLOCKED_URL_PREFIXES).toContain('about:');
  });

  it('blocks edge and brave prefixes', () => {
    expect(BLOCKED_URL_PREFIXES).toContain('edge://');
    expect(BLOCKED_URL_PREFIXES).toContain('brave://');
  });

  it('blocks moz-extension:// prefix', () => {
    expect(BLOCKED_URL_PREFIXES).toContain('moz-extension://');
  });
});

describe('TAB_GROUP_COLORS', () => {
  it('has all 10 Chrome tab group colors', () => {
    const expected = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey', 'gray'];
    for (const color of expected) {
      expect(TAB_GROUP_COLORS).toHaveProperty(color);
    }
  });

  it('all values are oklch color strings', () => {
    for (const value of Object.values(TAB_GROUP_COLORS)) {
      expect(value).toMatch(/^oklch\(.+\)$/);
    }
  });
});
