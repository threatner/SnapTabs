import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import { isRestorable, toSavedTab } from '../src/lib/tabs';

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
