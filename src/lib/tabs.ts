import type { SavedTab, SavedTabGroup, Session } from './types';
import { BLOCKED_URL_PREFIXES, uuid, formatSessionName, isExcludedUrl } from './types';
import { saveSession, getSettings } from './storage';
import { sleepTabsWhenLoaded } from './sleepTabs';

export function isRestorable(url: string): boolean {
  return !BLOCKED_URL_PREFIXES.some((p) => url.startsWith(p));
}

// ── Duplicate detection ──

// Strip trailing slash + fragment so trivial differences don't break the match.
export function normalizeUrlForSig(url: string): string {
  let u = url.split('#')[0];
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export function urlSetSignature(urls: string[]): string {
  return urls
    .map(normalizeUrlForSig)
    .filter((u) => u.length > 0)
    .sort()
    .join('|');
}

export function findDuplicateSession(urls: string[], sessions: Session[]): Session | null {
  // Filter both sides identically: saved sessions include non-restorable URLs
  // (chrome://newtab/, etc.), so we ignore those when comparing.
  const sig = urlSetSignature(urls.filter(isRestorable));
  if (!sig) return null;
  // Only check the most recent session — that's the accidental-double-click
  // case. The rolling backup is refreshed constantly, so it doesn't count.
  const sorted = sessions.filter((s) => !s.isBackup).sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted[0];
  if (!recent) return null;
  const recentSig = urlSetSignature(recent.tabs.map((t) => t.url).filter(isRestorable));
  return recentSig === sig ? recent : null;
}

// Merge incoming tab groups into an existing list, deduping by id. Tab-group
// ids are unique across windows within a browser session, so accumulating a
// multi-window capture by id is safe.
export function mergeGroups(existing: SavedTabGroup[], incoming: SavedTabGroup[]): SavedTabGroup[] {
  const seen = new Set(existing.map((g) => g.id));
  const merged = [...existing];
  for (const g of incoming) {
    if (!seen.has(g.id)) {
      seen.add(g.id);
      merged.push(g);
    }
  }
  return merged;
}

export function toSavedTab(t: chrome.tabs.Tab): SavedTab {
  const hasTabGroups = typeof chrome.tabGroups !== 'undefined';
  return {
    // A tab that is still loading reports url '' with the target in pendingUrl.
    url: t.url || t.pendingUrl || '',
    title: t.title ?? '',
    favIconUrl: t.favIconUrl || undefined,
    pinned: t.pinned ?? false,
    isIncognito: t.incognito,
    groupId: hasTabGroups && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? t.groupId : undefined,
    index: t.index,
    windowId: t.windowId,
  };
}

// ── Capture ──

export async function captureWindow(windowId: number): Promise<{ tabs: SavedTab[]; groups: SavedTabGroup[] }> {
  const [chromeTabs, chromeGroups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    safeQueryTabGroups(windowId),
  ]);

  const tabs: SavedTab[] = chromeTabs.map(toSavedTab);

  const groups: SavedTabGroup[] = chromeGroups.map((g) => ({
    id: g.id,
    title: g.title ?? '',
    color: g.color,
    collapsed: g.collapsed,
  }));

  return { tabs, groups };
}

export async function captureAllWindows(): Promise<{
  tabs: SavedTab[];
  groups: SavedTabGroup[];
  windowCount: number;
  hasIncognitoTabs: boolean;
}> {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const captures = await Promise.all(windows.map((w) => captureWindow(w.id!)));

  const allTabs: SavedTab[] = [];
  let allGroups: SavedTabGroup[] = [];

  for (const { tabs, groups } of captures) {
    allTabs.push(...tabs);
    allGroups = mergeGroups(allGroups, groups);
  }

  return {
    tabs: allTabs,
    groups: allGroups,
    windowCount: windows.length,
    hasIncognitoTabs: allTabs.some((t) => t.isIncognito),
  };
}

// ── Snapshot ──

export async function createSnapshot(name?: string, isAutoSave = false, windowId?: number): Promise<Session> {
  let tabs: SavedTab[];
  let groups: SavedTabGroup[];
  let windowCount: number;
  let hasIncognitoTabs: boolean;

  if (windowId !== undefined && windowId !== -1) {
    const capture = await captureWindow(windowId);
    tabs = capture.tabs;
    groups = capture.groups;
    windowCount = 1;
    hasIncognitoTabs = tabs.some((t) => t.isIncognito);
  } else {
    const result = await captureAllWindows();
    tabs = result.tabs;
    groups = result.groups;
    windowCount = result.windowCount;
    hasIncognitoTabs = result.hasIncognitoTabs;
  }

  const { excludedDomains } = await getSettings();
  if (excludedDomains.length > 0) {
    tabs = tabs.filter((t) => !isExcludedUrl(t.url, excludedDomains));
    hasIncognitoTabs = tabs.some((t) => t.isIncognito);
  }

  const session: Session = {
    id: uuid(),
    name: name || formatSessionName('Snapshot'),
    timestamp: Date.now(),
    tabs,
    tabGroups: groups,
    windowCount,
    hasIncognitoTabs,
    isAutoSave,
  };

  await saveSession(session);
  return session;
}

// ── Restore ──

export async function restoreSession(
  session: Session,
  restoreIncognitoToIncognito: boolean,
  restoreInNewWindow: boolean,
  sleepRestoredTabs = false,
): Promise<void> {
  // Each saved window comes back as its own window. Only the first one may
  // land in the current window (when restoreInNewWindow is off).
  let usedCurrentWindow = false;
  const backgroundTabIds: number[] = [];
  const regularWindows: SavedTab[][] = [];
  const incognitoWindows: SavedTab[][] = [];

  for (const windowTabs of splitByWindow(session.tabs, session.windowCount)) {
    const restorable = windowTabs.filter((t) => isRestorable(t.url));
    const toIncognito = restoreIncognitoToIncognito ? restorable.filter((t) => t.isIncognito) : [];
    const rest = restoreIncognitoToIncognito ? restorable.filter((t) => !t.isIncognito) : restorable;
    if (rest.length > 0) regularWindows.push(rest);
    if (toIncognito.length > 0) incognitoWindows.push(toIncognito);
  }

  // Regular windows first: "current window" means the last-focused one, and a
  // freshly created incognito window would otherwise become it.
  for (const tabs of regularWindows) {
    if (restoreInNewWindow || usedCurrentWindow) {
      backgroundTabIds.push(...await restoreInWindow(tabs, session.tabGroups, false));
    } else {
      backgroundTabIds.push(...await restoreInCurrent(tabs, session.tabGroups));
      usedCurrentWindow = true;
    }
  }
  for (const tabs of incognitoWindows) {
    backgroundTabIds.push(...await restoreInWindow(tabs, session.tabGroups, true));
  }

  // Not awaited: sleeping waits for each tab to finish loading, and the
  // restore itself is already done.
  if (sleepRestoredTabs && backgroundTabIds.length > 0) void sleepTabsWhenLoaded(backgroundTabIds);
}

// Splits a session's tabs into per-window lists, in the order windows were
// captured. Tab `index` is only unique within a window, so windows must be
// restored separately or their tabs interleave. Sessions saved before v1.9
// have no windowId, but their tabs were stored window-by-window, so an index
// that fails to increase marks the start of the next window.
export function splitByWindow(tabs: SavedTab[], windowCount: number): SavedTab[][] {
  if (tabs.length === 0) return [];
  if (windowCount <= 1) return [tabs];

  const windows = new Map<string, SavedTab[]>();
  let segment = 0;
  let prevIndex = -1;
  for (const tab of tabs) {
    if (tab.index <= prevIndex) segment++;
    prevIndex = tab.index;
    const key = tab.windowId !== undefined ? `w${tab.windowId}` : `s${segment}`;
    if (!windows.has(key)) windows.set(key, []);
    windows.get(key)!.push(tab);
  }
  return [...windows.values()];
}

// ── Stats ──

export async function getTabStats(): Promise<{
  totalTabs: number;
  incognitoTabs: number;
  windowCount: number;
}> {
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ windowTypes: ['normal'] }),
  ]);
  return {
    totalTabs: tabs.length,
    incognitoTabs: tabs.filter((t) => t.incognito).length,
    windowCount: windows.length,
  };
}

// ── Internal ──

// Both restore helpers focus the first restored tab and return the ids of the
// other (background) tabs, which are the ones eligible to be put to sleep.

async function restoreInCurrent(tabs: SavedTab[], sessionGroups: SavedTabGroup[]): Promise<number[]> {
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const ids: (number | undefined)[] = [];

  for (const tab of sorted) {
    try {
      const active = ids.every((id) => id === undefined);
      const created = await chrome.tabs.create({ url: tab.url, pinned: tab.pinned, active });
      ids.push(created.id);
    } catch {
      ids.push(undefined);
    }
  }

  const first = ids.find((id) => id !== undefined);
  if (first === undefined) return [];
  const windowId = (await chrome.tabs.get(first)).windowId;
  await recreateGroups(sorted, ids, sessionGroups, windowId);
  return ids.filter((id): id is number => id !== undefined && id !== first);
}

async function restoreInWindow(tabs: SavedTab[], sessionGroups: SavedTabGroup[], incognito: boolean): Promise<number[]> {
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const win = await chrome.windows.create({ url: sorted[0].url, incognito, focused: true });
  if (!win?.id) return [];

  const ids: (number | undefined)[] = [win.tabs?.[0]?.id];

  for (let i = 1; i < sorted.length; i++) {
    try {
      const created = await chrome.tabs.create({ windowId: win.id, url: sorted[i].url, pinned: sorted[i].pinned, index: i, active: false });
      ids.push(created.id);
    } catch {
      ids.push(undefined);
    }
  }

  if (sorted[0].pinned && ids[0]) await chrome.tabs.update(ids[0], { pinned: true });
  await recreateGroups(sorted, ids, sessionGroups, win.id);
  return ids.slice(1).filter((id): id is number => id !== undefined);
}

async function recreateGroups(tabs: SavedTab[], tabIds: (number | undefined)[], sessionGroups: SavedTabGroup[], windowId: number): Promise<void> {
  if (typeof chrome.tabs.group !== 'function') return; // Firefox doesn't support tab groups
  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < tabs.length; i++) {
    const gid = tabs[i].groupId;
    if (gid === undefined || !tabIds[i]) continue;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(tabIds[i]!);
  }

  for (const [originalId, ids] of groupMap) {
    if (ids.length === 0) continue;
    try {
      const newId = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId } });
      const meta = sessionGroups.find((g) => g.id === originalId);
      if (meta) await chrome.tabGroups.update(newId, { title: meta.title, color: meta.color, collapsed: meta.collapsed });
    } catch { /* pinned tabs can't be grouped */ }
  }
}

async function safeQueryTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
  try {
    if (chrome.tabGroups?.query) return await chrome.tabGroups.query({ windowId });
  } catch { /* not available */ }
  return [];
}
