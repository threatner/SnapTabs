import type { SavedTab, SavedTabGroup, Session } from './types';
import { BLOCKED_URL_PREFIXES, uuid, formatSessionName, isExcludedUrl } from './types';
import { saveSession, getSettings } from './storage';

export function isRestorable(url: string): boolean {
  return !BLOCKED_URL_PREFIXES.some((p) => url.startsWith(p));
}

// ── Duplicate detection ──

// Strip trailing slash + fragment so trivial differences don't break the match.
function normalizeUrlForSig(url: string): string {
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
  // Only check the most recent session — that's the accidental-double-click case.
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
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
    url: t.url ?? t.pendingUrl ?? '',
    title: t.title ?? '',
    favIconUrl: t.favIconUrl || undefined,
    pinned: t.pinned ?? false,
    isIncognito: t.incognito,
    groupId: hasTabGroups && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? t.groupId : undefined,
    index: t.index,
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
): Promise<void> {
  const restorable = session.tabs.filter((t) => isRestorable(t.url));
  const regular = restorable.filter((t) => !t.isIncognito);
  const incognito = restorable.filter((t) => t.isIncognito);

  if (regular.length > 0) {
    if (restoreInNewWindow) {
      await restoreInWindow(regular, session.tabGroups, false);
    } else {
      await restoreInCurrent(regular, session.tabGroups);
    }
  }

  if (incognito.length > 0) {
    if (restoreIncognitoToIncognito) {
      await restoreInWindow(incognito, session.tabGroups, true);
    } else if (restoreInNewWindow) {
      await restoreInWindow(incognito, session.tabGroups, false);
    } else {
      await restoreInCurrent(incognito, session.tabGroups);
    }
  }
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

async function restoreInCurrent(tabs: SavedTab[], sessionGroups: SavedTabGroup[]): Promise<void> {
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const ids: (number | undefined)[] = [];

  for (const tab of sorted) {
    try {
      const created = await chrome.tabs.create({ url: tab.url, pinned: tab.pinned });
      ids.push(created.id);
    } catch {
      ids.push(undefined);
    }
  }

  const first = ids.find((id) => id !== undefined);
  if (first === undefined) return;
  const windowId = (await chrome.tabs.get(first)).windowId;
  await recreateGroups(sorted, ids, sessionGroups, windowId);
}

async function restoreInWindow(tabs: SavedTab[], sessionGroups: SavedTabGroup[], incognito: boolean): Promise<void> {
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const win = await chrome.windows.create({ url: sorted[0].url, incognito, focused: true });
  if (!win?.id) return;

  const ids: (number | undefined)[] = [win.tabs?.[0]?.id];

  for (let i = 1; i < sorted.length; i++) {
    const created = await chrome.tabs.create({ windowId: win.id, url: sorted[i].url, pinned: sorted[i].pinned, index: i });
    ids.push(created.id);
  }

  if (sorted[0].pinned && ids[0]) await chrome.tabs.update(ids[0], { pinned: true });
  await recreateGroups(sorted, ids, sessionGroups, win.id);
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
