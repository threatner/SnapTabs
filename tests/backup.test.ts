import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import { scheduleBackup, runBackup, BACKUP_ALARM, BACKUP_NAME } from '../src/lib/backup';
import { getSessions, saveSession, updateSettings, importSessions, togglePin, renameSession } from '../src/lib/storage';
import { findDuplicateSession } from '../src/lib/tabs';
import { recoverLastSnapshot } from '../src/lib/browserClose';
import { saveLastSnapshot } from '../src/lib/storage';
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
