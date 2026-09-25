import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import { scheduleBackup, runBackup, shouldKeepPrevious, BACKUP_ALARM, BACKUP_NAME } from '../src/lib/backup';
import { getSessions, saveSession, updateSettings, importSessions, togglePin, renameSession } from '../src/lib/storage';
import { findDuplicateSession } from '../src/lib/tabs';
import { recoverLastSnapshot } from '../src/lib/browserClose';
import { saveLastSnapshot, retireBackup, setBackupRestartCheck, takeBackupRestartCheck, upsertBackup, recordVersion } from '../src/lib/storage';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import type { Session, SavedTab } from '../src/lib/types';

// Fake browser: windowId -> { incognito, tabs }.
type FakeWindow = { incognito: boolean; tabs: Partial<chrome.tabs.Tab>[] };
let browser: Record<number, FakeWindow>;

function openWindow(id: number, urls: string[], incognito = false) {
  browser[id] = {
    incognito,
    tabs: urls.map((url, index) => ({ id: id * 100 + index, url, title: url, index, windowId: id, pinned: false, incognito, groupId: -1 })),
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? `s-${Math.random()}`, name: 'S', timestamp: 1, tabs: [], tabGroups: [],
    windowCount: 1, hasIncognitoTabs: false, isAutoSave: false, ...overrides,
  };
}

const tabOf = (url: string): SavedTab => ({ url, title: url, pinned: false, isIncognito: false, index: 0 });

beforeEach(() => {
  resetChromeStorage();
  vi.clearAllMocks();
  browser = {};
  vi.mocked(chrome.windows.getAll).mockImplementation(async () =>
    Object.entries(browser).map(([id, w]) => ({ id: Number(id), incognito: w.incognito, type: 'normal' }) as chrome.windows.Window));
  vi.mocked(chrome.tabs.query).mockImplementation(async (q: chrome.tabs.QueryInfo) =>
    (browser[q.windowId!]?.tabs ?? []) as chrome.tabs.Tab[]);
  vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
});

describe('scheduleBackup', () => {
  it('creates a periodic alarm', async () => {
    await scheduleBackup(15);
    expect(chrome.alarms.create).toHaveBeenCalledWith(BACKUP_ALARM, { delayInMinutes: 15, periodInMinutes: 15 });
  });

  it('leaves an existing alarm with the same period alone, so SW restarts do not postpone it', async () => {
    await scheduleBackup(15);
    vi.mocked(chrome.alarms.create).mockClear();
    await scheduleBackup(15);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it('replaces the alarm when the interval changes', async () => {
    await scheduleBackup(15);
    await scheduleBackup(5);
    expect(chrome.alarms.create).toHaveBeenLastCalledWith(BACKUP_ALARM, { delayInMinutes: 5, periodInMinutes: 5 });
    expect((await chrome.alarms.get(BACKUP_ALARM))?.periodInMinutes).toBe(5);
  });

  it('clears the alarm when turned off', async () => {
    await scheduleBackup(15);
    await scheduleBackup(0);
    expect(await chrome.alarms.get(BACKUP_ALARM)).toBeUndefined();
  });

  it('does nothing when off and no alarm exists', async () => {
    await scheduleBackup(0);
    expect(chrome.alarms.clear).not.toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });
});

describe('runBackup', () => {
  it('does nothing when backup is off', async () => {
    openWindow(1, ['https://a.com']);
    expect(await runBackup()).toBeNull();
    expect(await getSessions()).toHaveLength(0);
  });

  it('saves all normal windows as a single backup session', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com', 'https://b.com']);
    openWindow(2, ['https://c.com']);

    const saved = await runBackup(1234);
    expect(saved).not.toBeNull();
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      name: BACKUP_NAME, isBackup: true, isAutoSave: true, windowCount: 2, timestamp: 1234, hasIncognitoTabs: false,
    });
    expect(sessions[0].tabs.map((t) => t.url)).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
    expect(sessions[0].tabs.map((t) => t.windowId)).toEqual([1, 1, 2]);
  });

  it('never includes incognito windows', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    openWindow(2, ['https://secret.com'], true);

    await runBackup();
    const [backup] = await getSessions();
    expect(backup.tabs.map((t) => t.url)).toEqual(['https://a.com']);
    expect(backup.windowCount).toBe(1);
  });

  it('applies excluded domains', async () => {
    await updateSettings({ autoBackupMinutes: 15, excludedDomains: ['bank.com'] });
    openWindow(1, ['https://a.com', 'https://my.bank.com/account']);
    openWindow(2, ['https://bank.com']);

    await runBackup();
    const [backup] = await getSessions();
    expect(backup.tabs.map((t) => t.url)).toEqual(['https://a.com']);
    expect(backup.windowCount).toBe(1);
  });

  it('does not save when nothing restorable is open', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['chrome://newtab/']);
    expect(await runBackup()).toBeNull();
    expect(await getSessions()).toHaveLength(0);
  });

  it('skips the write when tabs have not changed', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    await runBackup(1);
    vi.mocked(chrome.storage.local.set).mockClear();

    expect(await runBackup(2)).toBeNull();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect((await getSessions())[0].timestamp).toBe(1);
  });

  it('updates the same session in place when tabs change, keeping only one backup', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    const first = await runBackup(1);
    openWindow(1, ['https://a.com', 'https://b.com']);
    const second = await runBackup(2);

    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(second!.id).toBe(first!.id);
    expect(sessions[0].tabs).toHaveLength(2);
    expect(sessions[0].timestamp).toBe(2);
  });

  it('treats a reorder as a change', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com', 'https://b.com']);
    await runBackup(1);
    openWindow(1, ['https://b.com', 'https://a.com']);
    expect(await runBackup(2)).not.toBeNull();
  });

  it('keeps a user rename and pin across updates', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    const first = await runBackup(1);
    await renameSession(first!.id, 'My safety net');
    await togglePin(first!.id);
    openWindow(1, ['https://b.com']);
    await runBackup(2);

    const [backup] = await getSessions();
    expect(backup.name).toBe('My safety net');
    expect(backup.pinned).toBe(true);
  });

  it('leaves other sessions untouched', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    await saveSession(session({ id: 'manual', name: 'Manual' }));
    openWindow(1, ['https://a.com']);
    await runBackup(5);
    openWindow(1, ['https://b.com']);
    await runBackup(6);

    const ids = (await getSessions()).map((s) => s.id).sort();
    expect(ids).toHaveLength(2);
    expect(ids).toContain('manual');
  });
});

describe('backup and the rest of the system', () => {
  it('is never pruned by the session limit', async () => {
    await updateSettings({ autoBackupMinutes: 15, maxSessions: 2 });
    openWindow(1, ['https://a.com']);
    await runBackup(1);
    await saveSession(session({ id: 'm1', timestamp: 10 }));
    await saveSession(session({ id: 'm2', timestamp: 20 }));

    const sessions = await getSessions();
    expect(sessions.some((s) => s.isBackup)).toBe(true);
    expect(sessions.map((s) => s.id)).toContain('m2');
  });

  it('import turns an imported backup into an ordinary auto-save', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    await runBackup(1);
    await importSessions({
      source: 'snaptabs', version: 1, exportedAt: 1,
      sessions: [session({ id: 'other-backup', isAutoSave: true, isBackup: true, tabs: [tabOf('https://z.com')] })],
    });

    const sessions = await getSessions();
    expect(sessions.filter((s) => s.isBackup)).toHaveLength(1);
    expect(sessions.find((s) => s.id === 'other-backup')?.isBackup).toBeUndefined();
  });

  it('duplicate-snapshot check compares against the last real snapshot, not the backup', () => {
    const backup = session({ id: 'b', isBackup: true, isAutoSave: true, timestamp: 200, tabs: [tabOf('https://a.com')] });
    const older = session({ id: 'm', timestamp: 100, tabs: [tabOf('https://x.com')] });
    expect(findDuplicateSession(['https://a.com'], [backup, older])).toBeNull();
    expect(findDuplicateSession(['https://x.com'], [backup, older])?.id).toBe('m');
  });

  it('browser-close recovery is not suppressed by a matching backup', async () => {
    await saveSession(session({ id: 'b', isBackup: true, isAutoSave: true, timestamp: 5000, tabs: [tabOf('https://a.com')] }));
    await saveLastSnapshot({ tabs: [tabOf('https://a.com')], groups: [], windowCount: 1, updatedAt: 5000 });

    const recovered = await recoverLastSnapshot({ ...DEFAULT_SETTINGS, autoSnapshotOnBrowserClose: true });
    expect(recovered).not.toBeNull();
  });
});

const urls = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `https://${prefix}${i}.com`);
const savedTabs = (list: string[]): SavedTab[] => list.map((u, index) => ({ ...tabOf(u), index }));

describe('shouldKeepPrevious', () => {
  it('keeps nothing when no tabs are lost', () => {
    expect(shouldKeepPrevious(savedTabs(urls('a', 3)), savedTabs([...urls('a', 3), 'https://new.com']), true)).toBe(false);
  });

  it('after a restart, any loss keeps the previous backup', () => {
    expect(shouldKeepPrevious(savedTabs(urls('a', 3)), savedTabs(['https://homepage.com']), true)).toBe(true);
  });

  it('mid-session, everyday tab closing does not', () => {
    expect(shouldKeepPrevious(savedTabs(urls('a', 10)), savedTabs(urls('a', 8)), false)).toBe(false);
  });

  it('mid-session, a big loss does (a large window closed)', () => {
    expect(shouldKeepPrevious(savedTabs([...urls('big', 40), ...urls('small', 3)]), savedTabs(urls('small', 3)), false)).toBe(true);
  });

  it('mid-session, needs both 5+ tabs and half the backup', () => {
    expect(shouldKeepPrevious(savedTabs(urls('a', 4)), savedTabs([]), false)).toBe(false);
    expect(shouldKeepPrevious(savedTabs(urls('a', 20)), savedTabs(urls('a', 14)), false)).toBe(false);
    expect(shouldKeepPrevious(savedTabs(urls('a', 10)), savedTabs(urls('a', 5)), false)).toBe(true);
  });

  it('ignores non-restorable tabs and trivial URL differences', () => {
    const before = savedTabs(['chrome://newtab/', 'https://a.com/', 'https://b.com/#x']);
    expect(shouldKeepPrevious(before, savedTabs(['https://a.com', 'https://b.com']), true)).toBe(false);
  });
});

describe('backup and the session limit', () => {
  it('turning the backup on at the limit evicts nothing', async () => {
    await updateSettings({ maxSessions: 2 });
    await saveSession(session({ id: 'm1', timestamp: 10 }));
    await saveSession(session({ id: 'm2', timestamp: 20 }));
    await updateSettings({ autoBackupMinutes: 15, maxSessions: 2 });
    openWindow(1, ['https://a.com']);
    await runBackup(30);

    expect((await getSessions()).map((s) => s.id).sort()).toEqual(expect.arrayContaining(['m1', 'm2']));
    expect(await getSessions()).toHaveLength(3);
  });

  it('with maxSessions 1 and a backup, a new snapshot is kept', async () => {
    await updateSettings({ autoBackupMinutes: 15, maxSessions: 1 });
    openWindow(1, ['https://a.com']);
    await runBackup(1);
    await saveSession(session({ id: 'm1', timestamp: 10 }));
    expect((await getSessions()).map((s) => s.id)).toContain('m1');
  });
});

describe('backup after a restart or a big loss', () => {
  it('after a restart, keeps the pre-restart backup when tabs would be lost', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, urls('work', 6));
    const before = await runBackup(1000);

    // Browser restarts; Chrome only reopens a homepage.
    await setBackupRestartCheck();
    browser = {};
    openWindow(5, ['https://homepage.com']);
    await runBackup(2000);

    const sessions = await getSessions();
    const live = sessions.filter((s) => s.isBackup);
    const kept = sessions.filter((s) => !s.isBackup);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(before!.id);
    expect(live[0].tabs.map((t) => t.url)).toEqual(['https://homepage.com']);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).not.toBe(before!.id);
    expect(kept[0].isAutoSave).toBe(true);
    expect(kept[0].timestamp).toBe(1000);
    expect(kept[0].name).toMatch(new RegExp(`^${BACKUP_NAME} - `));
    expect(kept[0].tabs.map((t) => t.url)).toEqual(urls('work', 6));
    // The check is used up by that first backup.
    expect(await takeBackupRestartCheck()).toBe(false);
  });

  it('after a restart where Chrome reopened everything, just updates', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, urls('work', 6));
    await runBackup(1000);
    await setBackupRestartCheck();
    browser = {};
    openWindow(9, urls('work', 6)); // same tabs, new window id
    await runBackup(2000);

    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].isBackup).toBe(true);
  });

  it('mid-session, a big window closing keeps the previous backup', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, urls('big', 40));
    openWindow(2, urls('small', 3));
    await runBackup(1000);
    delete browser[1];
    await runBackup(2000);

    const kept = (await getSessions()).filter((s) => !s.isBackup);
    expect(kept).toHaveLength(1);
    expect(kept[0].tabs).toHaveLength(43);
  });

  it('mid-session, closing a couple of tabs keeps nothing extra', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, urls('a', 10));
    await runBackup(1000);
    openWindow(1, urls('a', 8));
    await runBackup(2000);
    expect(await getSessions()).toHaveLength(1);
  });

  it('a kept copy is unpinned and named after its time, even if the backup was pinned or renamed', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, urls('big', 10));
    const b = await runBackup(1000);
    await renameSession(b!.id, 'My safety net');
    await togglePin(b!.id);
    openWindow(1, ['https://one.com']);
    await runBackup(2000);

    const sessions = await getSessions();
    const live = sessions.find((s) => s.isBackup)!;
    const kept = sessions.find((s) => !s.isBackup)!;
    expect(live.name).toBe('My safety net');
    expect(live.pinned).toBe(true);
    expect(kept.name).toMatch(/^My safety net - /);
    expect(kept.pinned).toBeFalsy();
  });
});

describe('retireBackup (backup turned off)', () => {
  it('turns the backup into an ordinary auto-save, keeping its id and pin', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    const b = await runBackup(1000);
    await togglePin(b!.id);
    await retireBackup();

    const [s] = await getSessions();
    expect(s.id).toBe(b!.id);
    expect(s.isBackup).toBeUndefined();
    expect(s.isAutoSave).toBe(true);
    expect(s.pinned).toBe(true);
    expect(s.name).toMatch(new RegExp(`^${BACKUP_NAME} - `));
  });

  it('makes the old backup prunable again', async () => {
    await updateSettings({ autoBackupMinutes: 15, maxSessions: 1 });
    openWindow(1, ['https://a.com']);
    await runBackup(1000);
    await retireBackup();
    await saveSession(session({ id: 'm1', timestamp: 5000 }));
    expect((await getSessions()).map((s) => s.id)).toEqual(['m1']);
  });

  it('does nothing without a backup', async () => {
    await saveSession(session({ id: 'm1' }));
    vi.mocked(chrome.storage.local.set).mockClear();
    await retireBackup();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('backup races and limits (second review)', () => {
  it('a backup run that finishes after the backup was turned off writes nothing', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    openWindow(1, ['https://a.com']);
    const b = await runBackup(1000);
    // Turned off (and retired) while a later run is still capturing tabs.
    await updateSettings({ autoBackupMinutes: 0 });
    await retireBackup();
    const wrote = await upsertBackup({ ...b!, timestamp: 2000 });

    expect(wrote).toBe(false);
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].isBackup).toBeUndefined();
  });

  it('never gives the backup an id another session already has', async () => {
    await updateSettings({ autoBackupMinutes: 15 });
    await saveSession(session({ id: 'taken' }));
    await upsertBackup(session({ id: 'taken', isAutoSave: true }));
    const ids = (await getSessions()).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a copy kept after a restart survives the write that keeps it, even at the limit', async () => {
    await updateSettings({ autoBackupMinutes: 15, maxSessions: 2 });
    openWindow(1, urls('work', 6));
    await runBackup(1000);
    await saveSession(session({ id: 'm1', timestamp: 5000 }));
    await saveSession(session({ id: 'm2', timestamp: 6000 }));
    await setBackupRestartCheck();
    browser = {};
    openWindow(5, ['https://homepage.com']);
    await runBackup(7000);

    const kept = (await getSessions()).filter((s) => !s.isBackup && s.isAutoSave);
    expect(kept).toHaveLength(1);
    expect(kept[0].tabs).toHaveLength(6);
  });

  it('turning backup off at the limit keeps the last backup', async () => {
    await updateSettings({ autoBackupMinutes: 15, maxSessions: 1 });
    openWindow(1, ['https://a.com']);
    const b = await runBackup(1000);
    await saveSession(session({ id: 'm1', timestamp: 5000 }));
    await retireBackup();
    expect((await getSessions()).map((s) => s.id)).toContain(b!.id);
  });
});

describe('recordVersion', () => {
  it('reports a change the first time and after an update, not on reruns', async () => {
    expect(await recordVersion('1.9.0')).toBe(true);
    expect(await recordVersion('1.9.0')).toBe(false);
    expect(await recordVersion('1.9.1')).toBe(true);
  });
});
