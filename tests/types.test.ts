import { describe, it, expect } from 'vitest';
import {
  formatSessionName,
  uuid,
  BLOCKED_URL_PREFIXES,
  DEFAULT_SETTINGS,
  TAB_GROUP_COLORS,
  normalizeDomain,
  urlMatchesDomain,
  isExcludedUrl,
  getHostname,
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
    expect(DEFAULT_SETTINGS.warnOnDuplicateSnapshot).toBe(true);
    expect(DEFAULT_SETTINGS.excludedDomains).toEqual([]);
  });

  it('has all nine settings', () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(9);
  });
});

describe('normalizeDomain', () => {
  it('strips protocol, www, and path', () => {
    expect(normalizeDomain('https://www.Example.com/path?x=1')).toBe('example.com');
    expect(normalizeDomain('http://foo.bar')).toBe('foo.bar');
    expect(normalizeDomain('  GitHub.com  ')).toBe('github.com');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain('   ')).toBe('');
  });

  it('strips query string and fragment', () => {
    expect(normalizeDomain('example.com?foo=bar')).toBe('example.com');
    expect(normalizeDomain('example.com#section')).toBe('example.com');
    expect(normalizeDomain('example.com/path?q=1#h')).toBe('example.com');
  });

  it('preserves subdomains', () => {
    expect(normalizeDomain('mail.google.com')).toBe('mail.google.com');
    expect(normalizeDomain('https://a.b.c.example.com/')).toBe('a.b.c.example.com');
  });

  it('preserves port number', () => {
    expect(normalizeDomain('localhost:3000')).toBe('localhost:3000');
  });

  it('only strips leading www., not embedded', () => {
    expect(normalizeDomain('wwwsomething.com')).toBe('wwwsomething.com');
    expect(normalizeDomain('foo.www.com')).toBe('foo.www.com');
  });
});

describe('getHostname', () => {
  it('extracts lowercase hostname', () => {
    expect(getHostname('https://API.Example.com/v1')).toBe('api.example.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(getHostname('not a url')).toBe('');
  });
});

describe('urlMatchesDomain', () => {
  it('matches exact host', () => {
    expect(urlMatchesDomain('https://github.com/repo', 'github.com')).toBe(true);
  });

  it('matches subdomain', () => {
    expect(urlMatchesDomain('https://api.github.com/x', 'github.com')).toBe(true);
  });

  it('matches deeply nested subdomain', () => {
    expect(urlMatchesDomain('https://a.b.c.example.com/x', 'example.com')).toBe(true);
  });

  it('does not match unrelated domain', () => {
    expect(urlMatchesDomain('https://notgithub.com', 'github.com')).toBe(false);
    expect(urlMatchesDomain('https://example.com', 'github.com')).toBe(false);
  });

  it('does not match when domain is a substring but not subdomain', () => {
    expect(urlMatchesDomain('https://evilgithub.com', 'github.com')).toBe(false);
    expect(urlMatchesDomain('https://github.com.evil.com', 'github.com')).toBe(false);
  });

  it('returns false on invalid url', () => {
    expect(urlMatchesDomain('garbage', 'github.com')).toBe(false);
  });

  it('returns false for empty domain', () => {
    expect(urlMatchesDomain('https://github.com', '')).toBe(false);
  });

  it('is case-insensitive on hostname', () => {
    expect(urlMatchesDomain('https://GitHub.COM/repo', 'github.com')).toBe(true);
  });

  it('matches subdomain with specific subdomain target', () => {
    expect(urlMatchesDomain('https://inbox.mail.google.com', 'mail.google.com')).toBe(true);
    expect(urlMatchesDomain('https://drive.google.com', 'mail.google.com')).toBe(false);
  });
});

describe('isExcludedUrl', () => {
  it('matches against any domain in the list', () => {
    expect(isExcludedUrl('https://mail.google.com/inbox', ['mail.google.com', 'bank.com'])).toBe(true);
    expect(isExcludedUrl('https://example.com', ['mail.google.com'])).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(isExcludedUrl('https://example.com', [])).toBe(false);
  });

  it('returns false for invalid URL even with non-empty list', () => {
    expect(isExcludedUrl('not a url', ['example.com'])).toBe(false);
    expect(isExcludedUrl('', ['example.com'])).toBe(false);
  });

  it('matches subdomain via parent domain rule', () => {
    expect(isExcludedUrl('https://api.github.com', ['github.com'])).toBe(true);
  });

  it('does not false-match similar-looking domains', () => {
    expect(isExcludedUrl('https://github.com.attacker.com', ['github.com'])).toBe(false);
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
