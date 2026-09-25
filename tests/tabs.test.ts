import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import { isRestorable, toSavedTab, urlSetSignature, findDuplicateSession, splitByWindow, restoreSession } from '../src/lib/tabs';
import type { Session, SavedTab } from '../src/lib/types';
import { sleepTabsWhenLoaded } from '../src/lib/sleepTabs';

vi.mock('../src/lib/sleepTabs', () => ({ sleepTabsWhenLoaded: vi.fn(async () => {}) }));

describe('isRestorable', () => {
  it('allows normal http URLs', () => {
    expect(isRestorable('https://example.com')).toBe(true);
    expect(isRestorable('http://localhost:3000')).toBe(true);
  });

  it('allows file URLs', () => {
    expect(isRestorable('file:///home/user/doc.pdf')).toBe(true);
  });

  it('allows ftp URLs', () => {
    expect(isRestorable('ftp://files.example.com/readme.txt')).toBe(true);
  });

  it('blocks chrome:// URLs', () => {
    expect(isRestorable('chrome://settings')).toBe(false);
    expect(isRestorable('chrome://extensions')).toBe(false);
    expect(isRestorable('chrome://newtab')).toBe(false);
  });

  it('blocks chrome-extension:// URLs', () => {
    expect(isRestorable('chrome-extension://abcdef/popup.html')).toBe(false);
  });

  it('blocks about: URLs', () => {
    expect(isRestorable('about:blank')).toBe(false);
    expect(isRestorable('about:config')).toBe(false);
  });

  it('blocks edge:// URLs', () => {
    expect(isRestorable('edge://settings')).toBe(false);
  });

  it('blocks brave:// URLs', () => {
    expect(isRestorable('brave://settings')).toBe(false);
  });

  it('blocks moz-extension:// URLs', () => {
    expect(isRestorable('moz-extension://abc/popup.html')).toBe(false);
  });

  it('handles empty string', () => {
    expect(isRestorable('')).toBe(true);
  });
});

describe('toSavedTab', () => {
  it('maps basic tab properties', () => {
    const chromeTab = {
      id: 1,
      index: 0,
      url: 'https://example.com',
      title: 'Example',
      favIconUrl: 'https://example.com/favicon.ico',
      pinned: true,
      incognito: false,
      groupId: -1,
      windowId: 1,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.url).toBe('https://example.com');
    expect(saved.title).toBe('Example');
    expect(saved.favIconUrl).toBe('https://example.com/favicon.ico');
    expect(saved.pinned).toBe(true);
    expect(saved.isIncognito).toBe(false);
    expect(saved.index).toBe(0);
    expect(saved.windowId).toBe(1);
  });

  it('uses pendingUrl when url is undefined', () => {
    const chromeTab = {
      id: 2,
      index: 1,
      pendingUrl: 'https://pending.com',
      title: 'Loading...',
      pinned: false,
      incognito: false,
      groupId: -1,
      windowId: 1,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.url).toBe('https://pending.com');
  });

  it('uses pendingUrl when a loading tab reports an empty url', () => {
    const chromeTab = {
      id: 4,
      index: 0,
      url: '',
      pendingUrl: 'https://still-loading.com',
      title: '',
      pinned: false,
      incognito: false,
      groupId: -1,
      windowId: 1,
    } as chrome.tabs.Tab;

    expect(toSavedTab(chromeTab).url).toBe('https://still-loading.com');
  });

  it('maps incognito tab correctly', () => {
    const chromeTab = {
      id: 3,
      index: 0,
      url: 'https://private.com',
      title: 'Private',
      pinned: false,
      incognito: true,
      groupId: -1,
      windowId: 2,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.isIncognito).toBe(true);
  });

  it('excludes groupId when TAB_GROUP_ID_NONE', () => {
    const chromeTab = {
      id: 4,
      index: 0,
      url: 'https://example.com',
      title: 'Example',
      pinned: false,
      incognito: false,
      groupId: -1, // TAB_GROUP_ID_NONE
      windowId: 1,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.groupId).toBeUndefined();
  });

  it('includes groupId when tab is in a group', () => {
    const chromeTab = {
      id: 5,
      index: 0,
      url: 'https://example.com',
      title: 'Grouped',
      pinned: false,
      incognito: false,
      groupId: 42,
      windowId: 1,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.groupId).toBe(42);
  });

  it('sets favIconUrl to undefined when empty string', () => {
    const chromeTab = {
      id: 6,
      index: 0,
      url: 'https://example.com',
      title: 'No Favicon',
      favIconUrl: '',
      pinned: false,
      incognito: false,
      groupId: -1,
      windowId: 1,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.favIconUrl).toBeUndefined();
  });

  it('defaults to empty string when url and pendingUrl are both undefined', () => {
    const chromeTab = {
      id: 7,
      index: 0,
      title: 'No URL',
      pinned: false,
      incognito: false,
      groupId: -1,
      windowId: 1,
      active: false,
      highlighted: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
    } as chrome.tabs.Tab;

    const saved = toSavedTab(chromeTab);
    expect(saved.url).toBe('');
  });
});

describe('captureWindow', () => {
  beforeEach(() => {
    resetChromeStorage();
    vi.restoreAllMocks();
  });

  it('captures tabs and groups from a window', async () => {
    const { captureWindow } = await import('../src/lib/tabs');

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      {
        id: 1, index: 0, url: 'https://a.com', title: 'A',
        pinned: false, incognito: false, groupId: -1, windowId: 10,
      } as chrome.tabs.Tab,
      {
        id: 2, index: 1, url: 'https://b.com', title: 'B',
        pinned: true, incognito: false, groupId: 5, windowId: 10,
      } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([
      { id: 5, title: 'Group', color: 'blue' as chrome.tabGroups.ColorEnum, collapsed: false, windowId: 10 },
    ]);

    const result = await captureWindow(10);

    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[0].url).toBe('https://a.com');
    expect(result.tabs[1].pinned).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].title).toBe('Group');
  });
});

describe('captureAllWindows', () => {
  beforeEach(() => {
    resetChromeStorage();
    vi.restoreAllMocks();
  });

  it('captures tabs across multiple windows and deduplicates groups', async () => {
    const { captureAllWindows } = await import('../src/lib/tabs');

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: false } as chrome.windows.Window,
      { id: 2, incognito: true } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query)
      .mockResolvedValueOnce([
        { id: 1, index: 0, url: 'https://a.com', title: 'A', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
      ])
      .mockResolvedValueOnce([
        { id: 2, index: 0, url: 'https://b.com', title: 'B', pinned: false, incognito: true, groupId: -1, windowId: 2 } as chrome.tabs.Tab,
      ]);

    vi.mocked(chrome.tabGroups.query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await captureAllWindows();
    expect(result.tabs).toHaveLength(2);
    expect(result.windowCount).toBe(2);
    expect(result.hasIncognitoTabs).toBe(true);
  });
});

describe('createSnapshot', () => {
  beforeEach(() => {
    resetChromeStorage();
    vi.restoreAllMocks();
  });

  it('creates a snapshot and saves it', async () => {
    const { createSnapshot } = await import('../src/lib/tabs');
    const { getSessions } = await import('../src/lib/storage');

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: false } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 1, index: 0, url: 'https://example.com', title: 'Example', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([]);

    const session = await createSnapshot('Test Snapshot');
    expect(session.name).toBe('Test Snapshot');
    expect(session.tabs).toHaveLength(1);
    expect(session.isAutoSave).toBe(false);

    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
  });

  it('filters out tabs from excluded domains', async () => {
    const { createSnapshot } = await import('../src/lib/tabs');
    const { updateSettings } = await import('../src/lib/storage');

    await updateSettings({ excludedDomains: ['mail.google.com'] });

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: false } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 1, index: 0, url: 'https://mail.google.com/inbox', title: 'Inbox', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
      { id: 2, index: 1, url: 'https://example.com', title: 'Example', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([]);

    const session = await createSnapshot('Filtered');
    expect(session.tabs).toHaveLength(1);
    expect(session.tabs[0].url).toBe('https://example.com');
  });

  it('preserves all tabs when no excluded domains configured', async () => {
    const { createSnapshot } = await import('../src/lib/tabs');

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: false } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 1, index: 0, url: 'https://a.com', title: 'A', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
      { id: 2, index: 1, url: 'https://b.com', title: 'B', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([]);

    const session = await createSnapshot('All');
    expect(session.tabs).toHaveLength(2);
  });

  it('filters subdomain when parent domain is excluded', async () => {
    const { createSnapshot } = await import('../src/lib/tabs');
    const { updateSettings } = await import('../src/lib/storage');

    await updateSettings({ excludedDomains: ['github.com'] });

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: false } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 1, index: 0, url: 'https://api.github.com/user', title: 'API', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
      { id: 2, index: 1, url: 'https://example.com', title: 'Keep', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([]);

    const session = await createSnapshot('Subdomain');
    expect(session.tabs).toHaveLength(1);
    expect(session.tabs[0].url).toBe('https://example.com');
  });

  it('updates hasIncognitoTabs after excluded domain filtering', async () => {
    const { createSnapshot } = await import('../src/lib/tabs');
    const { updateSettings } = await import('../src/lib/storage');

    await updateSettings({ excludedDomains: ['private.com'] });

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: true } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 1, index: 0, url: 'https://private.com', title: 'X', pinned: false, incognito: true, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
      { id: 2, index: 1, url: 'https://public.com', title: 'Y', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([]);

    const session = await createSnapshot('Filter incognito');
    // The only incognito tab was filtered out, so hasIncognitoTabs should be false.
    expect(session.tabs).toHaveLength(1);
    expect(session.hasIncognitoTabs).toBe(false);
  });

  it('produces empty session when every tab is excluded', async () => {
    const { createSnapshot } = await import('../src/lib/tabs');
    const { updateSettings } = await import('../src/lib/storage');

    await updateSettings({ excludedDomains: ['example.com'] });

    vi.mocked(chrome.windows.getAll).mockResolvedValueOnce([
      { id: 1, incognito: false } as chrome.windows.Window,
    ]);

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 1, index: 0, url: 'https://example.com/a', title: 'A', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
      { id: 2, index: 1, url: 'https://example.com/b', title: 'B', pinned: false, incognito: false, groupId: -1, windowId: 1 } as chrome.tabs.Tab,
    ]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValueOnce([]);

    const session = await createSnapshot('Empty');
    expect(session.tabs).toEqual([]);
  });
});

describe('urlSetSignature', () => {
  it('is order-independent', () => {
    expect(urlSetSignature(['https://b.com', 'https://a.com']))
      .toBe(urlSetSignature(['https://a.com', 'https://b.com']));
  });

  it('ignores trailing slash and fragment', () => {
    expect(urlSetSignature(['https://a.com/']))
      .toBe(urlSetSignature(['https://a.com#hash']));
  });

  it('differs for different URL sets', () => {
    expect(urlSetSignature(['https://a.com']))
      .not.toBe(urlSetSignature(['https://a.com', 'https://b.com']));
  });

  it('returns empty for empty input', () => {
    expect(urlSetSignature([])).toBe('');
  });

  it('returns empty when all URLs are empty strings', () => {
    expect(urlSetSignature(['', '', ''])).toBe('');
  });

  it('treats query strings as significant', () => {
    expect(urlSetSignature(['https://a.com?x=1']))
      .not.toBe(urlSetSignature(['https://a.com?x=2']));
  });

  it('treats different paths as different', () => {
    expect(urlSetSignature(['https://a.com/foo']))
      .not.toBe(urlSetSignature(['https://a.com/bar']));
  });
});

describe('findDuplicateSession', () => {
  const mk = (id: string, ts: number, urls: string[]): Session => ({
    id, name: id, timestamp: ts,
    tabs: urls.map((url, i) => ({ url, title: '', pinned: false, isIncognito: false, index: i })),
    tabGroups: [], windowCount: 1, hasIncognitoTabs: false, isAutoSave: false,
  });

  it('matches when URL set is identical to most recent session', () => {
    const sessions = [
      mk('old', 100, ['https://x.com']),
      mk('recent', 200, ['https://a.com', 'https://b.com']),
    ];
    const dup = findDuplicateSession(['https://b.com', 'https://a.com'], sessions);
    expect(dup?.id).toBe('recent');
  });

  it('returns null when URL set differs from most recent', () => {
    const sessions = [
      mk('recent', 200, ['https://a.com']),
    ];
    expect(findDuplicateSession(['https://different.com'], sessions)).toBeNull();
  });

  it('only checks the most recent session, not older ones', () => {
    const sessions = [
      mk('matching-but-old', 100, ['https://a.com']),
      mk('recent-different', 200, ['https://b.com']),
    ];
    expect(findDuplicateSession(['https://a.com'], sessions)).toBeNull();
  });

  it('returns null for empty inputs', () => {
    expect(findDuplicateSession([], [])).toBeNull();
    expect(findDuplicateSession(['https://a.com'], [])).toBeNull();
  });

  it('ignores non-restorable URLs on both sides', () => {
    // Saved session has chrome://newtab + a real tab; candidate has just the real tab.
    // These should still be considered a duplicate.
    const sessions = [
      mk('recent', 200, ['chrome://newtab/', 'https://a.com']),
    ];
    const dup = findDuplicateSession(['chrome://newtab/', 'https://a.com'], sessions);
    expect(dup?.id).toBe('recent');

    const dup2 = findDuplicateSession(['https://a.com'], sessions);
    expect(dup2?.id).toBe('recent');
  });

  it('returns null when candidate has only non-restorable URLs', () => {
    const sessions = [mk('recent', 200, ['chrome://newtab/'])];
    expect(findDuplicateSession(['chrome://newtab/'], sessions)).toBeNull();
  });

  it('matches when only difference is trailing slash', () => {
    const sessions = [mk('recent', 200, ['https://a.com/'])];
    expect(findDuplicateSession(['https://a.com'], sessions)?.id).toBe('recent');
  });

  it('matches when only difference is URL fragment', () => {
    const sessions = [mk('recent', 200, ['https://a.com#top'])];
    expect(findDuplicateSession(['https://a.com#bottom'], sessions)?.id).toBe('recent');
  });

  it('detects extra tab in candidate', () => {
    const sessions = [mk('recent', 200, ['https://a.com'])];
    expect(findDuplicateSession(['https://a.com', 'https://b.com'], sessions)).toBeNull();
  });

  it('detects missing tab in candidate', () => {
    const sessions = [mk('recent', 200, ['https://a.com', 'https://b.com'])];
    expect(findDuplicateSession(['https://a.com'], sessions)).toBeNull();
  });
});

describe('restoreSession', () => {
  beforeEach(() => {
    resetChromeStorage();
    vi.restoreAllMocks();
  });

  it('filters out non-restorable URLs', async () => {
    const { restoreSession } = await import('../src/lib/tabs');

    const session = {
      id: 'test',
      name: 'Test',
      timestamp: Date.now(),
      tabs: [
        { url: 'https://example.com', title: 'Good', pinned: false, isIncognito: false, index: 0 },
        { url: 'chrome://settings', title: 'Blocked', pinned: false, isIncognito: false, index: 1 },
        { url: 'about:blank', title: 'Blocked', pinned: false, isIncognito: false, index: 2 },
      ],
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: false,
    };

    vi.mocked(chrome.tabs.create).mockResolvedValue({
      id: 100, windowId: 1, index: 0, pinned: false, highlighted: false,
      active: false, incognito: false, selected: false, discarded: false,
      autoDiscardable: true, groupId: -1,
    } as chrome.tabs.Tab);

    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 100, windowId: 1, index: 0, pinned: false, highlighted: false,
      active: false, incognito: false, selected: false, discarded: false,
      autoDiscardable: true, groupId: -1,
    } as chrome.tabs.Tab);

    await restoreSession(session, false, false);

    // Only the example.com tab should be created
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' }),
    );
  });

  it('separates incognito tabs to incognito window when setting enabled', async () => {
    const { restoreSession } = await import('../src/lib/tabs');

    const session = {
      id: 'test',
      name: 'Mixed Session',
      timestamp: Date.now(),
      tabs: [
        { url: 'https://regular.com', title: 'Regular', pinned: false, isIncognito: false, index: 0 },
        { url: 'https://private.com', title: 'Private', pinned: false, isIncognito: true, index: 1 },
      ],
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: true,
      isAutoSave: false,
    };

    vi.mocked(chrome.tabs.create).mockResolvedValue({
      id: 100, windowId: 1, index: 0, pinned: false, highlighted: false,
      active: false, incognito: false, selected: false, discarded: false,
      autoDiscardable: true, groupId: -1,
    } as chrome.tabs.Tab);

    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 100, windowId: 1, index: 0, pinned: false, highlighted: false,
      active: false, incognito: false, selected: false, discarded: false,
      autoDiscardable: true, groupId: -1,
    } as chrome.tabs.Tab);

    vi.mocked(chrome.windows.create).mockResolvedValue({
      id: 2, incognito: true, tabs: [{ id: 200 }],
    } as unknown as chrome.windows.Window);

    await restoreSession(session, true, false);

    // Regular tab restored in current window
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://regular.com' }),
    );
    // Incognito tab restored in new incognito window
    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ incognito: true }),
    );
  });
});

describe('splitByWindow', () => {
  const tab = (url: string, index: number, windowId?: number): SavedTab => ({
    url, title: url, pinned: false, isIncognito: false, index, windowId,
  });

  it('returns a single window when windowCount is 1', () => {
    const tabs = [tab('a', 0, 1), tab('b', 0, 2)];
    expect(splitByWindow(tabs, 1)).toEqual([tabs]);
  });

  it('returns nothing for an empty session', () => {
    expect(splitByWindow([], 3)).toEqual([]);
  });

  it('groups by windowId in first-seen order', () => {
    const tabs = [tab('a1', 0, 7), tab('a2', 1, 7), tab('b1', 0, 3), tab('b2', 1, 3)];
    expect(splitByWindow(tabs, 2).map((w) => w.map((t) => t.url))).toEqual([['a1', 'a2'], ['b1', 'b2']]);
  });

  it('splits legacy sessions (no windowId) where the index resets', () => {
    const tabs = [tab('a1', 0), tab('a2', 1), tab('a3', 2), tab('b1', 0), tab('b2', 1), tab('c1', 0)];
    expect(splitByWindow(tabs, 3).map((w) => w.map((t) => t.url))).toEqual([['a1', 'a2', 'a3'], ['b1', 'b2'], ['c1']]);
  });

  it('tolerates index gaps from filtered tabs in legacy sessions', () => {
    const tabs = [tab('a1', 0), tab('a3', 2), tab('b2', 1), tab('b4', 3)];
    expect(splitByWindow(tabs, 2).map((w) => w.map((t) => t.url))).toEqual([['a1', 'a3'], ['b2', 'b4']]);
  });
});

describe('restoreSession (multi-window)', () => {
  beforeEach(() => {
    resetChromeStorage();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const tab = (url: string, index: number, windowId?: number, isIncognito = false): SavedTab => ({
    url, title: url, pinned: false, isIncognito, index, windowId,
  });

  const session = (tabs: SavedTab[], windowCount: number): Session => ({
    id: 's', name: 'S', timestamp: 0, tabs, tabGroups: [], windowCount,
    hasIncognitoTabs: tabs.some((t) => t.isIncognito), isAutoSave: true,
  });

  function mockCreation() {
    let nextTab = 1000;
    let nextWin = 50;
    vi.mocked(chrome.tabs.create).mockImplementation(async (opts) =>
      ({ id: nextTab++, windowId: opts.windowId ?? 1 }) as chrome.tabs.Tab);
    vi.mocked(chrome.tabs.get).mockImplementation(async (id) => ({ id, windowId: 1 }) as chrome.tabs.Tab);
    vi.mocked(chrome.windows.create).mockImplementation(async (opts) =>
      ({ id: nextWin++, incognito: opts?.incognito ?? false, tabs: [{ id: nextTab++ }] }) as unknown as chrome.windows.Window);
  }

  it('restores each saved window into its own window, first into the current one', async () => {
    mockCreation();
    const s = session([
      tab('https://a1.com', 0, 7), tab('https://a2.com', 1, 7),
      tab('https://b1.com', 0, 3), tab('https://b2.com', 1, 3),
      tab('https://c1.com', 0, 9),
    ], 3);

    await restoreSession(s, true, false);

    const tabCalls = vi.mocked(chrome.tabs.create).mock.calls.map(([o]) => [o.url, o.windowId]);
    expect(tabCalls).toEqual([
      ['https://a1.com', undefined],
      ['https://a2.com', undefined],
      ['https://b2.com', 50],
    ]);
    const winCalls = vi.mocked(chrome.windows.create).mock.calls.map(([o]) => o?.url);
    expect(winCalls).toEqual(['https://b1.com', 'https://c1.com']);
  });

  it('opens every window new when restoreInNewWindow is on', async () => {
    mockCreation();
    const s = session([tab('https://a1.com', 0, 7), tab('https://b1.com', 0, 3)], 2);

    await restoreSession(s, true, true);

    expect(vi.mocked(chrome.windows.create).mock.calls.map(([o]) => o?.url)).toEqual(['https://a1.com', 'https://b1.com']);
  });

  it('does not interleave tabs of legacy multi-window sessions', async () => {
    mockCreation();
    const s = session([
      tab('https://a1.com', 0), tab('https://a2.com', 1),
      tab('https://b1.com', 0), tab('https://b2.com', 1),
    ], 2);

    await restoreSession(s, true, false);

    const tabUrls = vi.mocked(chrome.tabs.create).mock.calls.map(([o]) => o.url);
    expect(tabUrls).toEqual(['https://a1.com', 'https://a2.com', 'https://b2.com']);
    expect(vi.mocked(chrome.windows.create).mock.calls.map(([o]) => o?.url)).toEqual(['https://b1.com']);
  });

  it('keeps an incognito window separate and incognito', async () => {
    mockCreation();
    const s = session([
      tab('https://a1.com', 0, 7),
      tab('https://p1.com', 0, 8, true), tab('https://p2.com', 1, 8, true),
    ], 2);

    await restoreSession(s, true, false);

    expect(vi.mocked(chrome.windows.create).mock.calls).toEqual([
      [expect.objectContaining({ url: 'https://p1.com', incognito: true })],
    ]);
  });

  it('focuses the first restored tab in the current window, not the last', async () => {
    mockCreation();
    const s = session([tab('https://a1.com', 0, 7), tab('https://a2.com', 1, 7), tab('https://a3.com', 2, 7)], 1);

    await restoreSession(s, true, false);

    expect(vi.mocked(chrome.tabs.create).mock.calls.map(([o]) => o.active)).toEqual([true, false, false]);
  });

  it('opens extra tabs of a new window in the background', async () => {
    mockCreation();
    const s = session([tab('https://a1.com', 0, 7), tab('https://a2.com', 1, 7)], 1);

    await restoreSession(s, true, true);

    expect(vi.mocked(chrome.tabs.create).mock.calls.map(([o]) => o.active)).toEqual([false]);
  });

  it('puts every background tab to sleep when enabled, never the focused ones', async () => {
    mockCreation();
    const s = session([
      tab('https://a1.com', 0, 7), tab('https://a2.com', 1, 7),
      tab('https://b1.com', 0, 3), tab('https://b2.com', 1, 3),
    ], 2);

    await restoreSession(s, true, false, true);

    // Current window: a1 (1000, focused) + a2 (1001). New window: b1 is the
    // window's own first tab (1002), b2 (1003).
    expect(sleepTabsWhenLoaded).toHaveBeenCalledTimes(1);
    expect(sleepTabsWhenLoaded).toHaveBeenCalledWith([1001, 1003]);
  });

  it('does not sleep tabs when disabled', async () => {
    mockCreation();
    const s = session([tab('https://a1.com', 0, 7), tab('https://a2.com', 1, 7)], 1);

    await restoreSession(s, true, false, false);

    expect(sleepTabsWhenLoaded).not.toHaveBeenCalled();
  });
});
