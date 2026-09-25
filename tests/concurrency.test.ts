import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import {
  getSessions, saveSession, upsertBackup, renameSession, togglePin, deleteSession,
  importSessions, updateSettings, getSettings, recordRestore, getMeta,
} from '../src/lib/storage';
import type { Session } from '../src/lib/types';

// Every session/settings/meta write is a read-modify-write of one storage
// key. Without serialization, concurrent writers (service worker timers,
// the popup, the welcome page) silently drop each other's changes.

function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id, name: id, timestamp: Number(id.replace(/\D/g, '')) || 1, tabs: [], tabGroups: [],
    windowCount: 1, hasIncognitoTabs: false, isAutoSave: false, ...overrides,
  };
}

describe('concurrent storage writes', () => {
  beforeEach(() => resetChromeStorage());

  it('keeps every session when many are saved at once', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => saveSession(session(`s${i + 1}`))));
    expect(await getSessions()).toHaveLength(20);
  });

  it('a backup refresh never drops a snapshot saved at the same moment', async () => {
    await Promise.all([
      upsertBackup(session('backup', { isAutoSave: true, isBackup: true })),
      saveSession(session('manual1')),
      upsertBackup(session('backup', { isAutoSave: true, isBackup: true, timestamp: 9 })),
      saveSession(session('manual2')),
    ]);
    const ids = (await getSessions()).map((s) => s.id).sort();
    expect(ids).toEqual(['backup', 'manual1', 'manual2']);
  });

  it('rename, pin, delete and save interleave without losing changes', async () => {
    await saveSession(session('a1'));
    await saveSession(session('b2'));
    await saveSession(session('c3'));
    await Promise.all([
      renameSession('a1', 'Renamed'),
      togglePin('b2'),
      deleteSession('c3'),
      saveSession(session('d4')),
      importSessions({ source: 'snaptabs', version: 1, exportedAt: 1, sessions: [session('e5')] }),
    ]);
    const byId = Object.fromEntries((await getSessions()).map((s) => [s.id, s]));
    expect(Object.keys(byId).sort()).toEqual(['a1', 'b2', 'd4', 'e5']);
    expect(byId.a1.name).toBe('Renamed');
    expect(byId.b2.pinned).toBe(true);
  });

  it('concurrent settings updates all land', async () => {
    await Promise.all([
      updateSettings({ autoSnapshotOnBrowserClose: true }),
      updateSettings({ autoBackupMinutes: 15 }),
      updateSettings({ maxSessions: 99 }),
    ]);
    const s = await getSettings();
    expect([s.autoSnapshotOnBrowserClose, s.autoBackupMinutes, s.maxSessions]).toEqual([true, 15, 99]);
  });

  it('concurrent restores are all counted', async () => {
    await Promise.all(Array.from({ length: 5 }, () => recordRestore()));
    expect((await getMeta()).restoreCount).toBe(5);
  });
});

describe('concurrent live-recording writes', () => {
  beforeEach(() => resetChromeStorage());

  it('records every tab when several finish loading at once, and stop waits for them', async () => {
    const { startRecording, addTabToRecording, stopRecording } = await import('../src/lib/storage');
    await startRecording('rec', -1);
    const tab = (url: string) => ({ url, title: url, pinned: false, isIncognito: false, index: 0 });
    const adds = ['a', 'b', 'c', 'd', 'e'].map((x) => addTabToRecording(tab(`https://${x}.com`)));
    const stopped = stopRecording();
    await Promise.all(adds);
    const session = await stopped;
    expect(session?.tabs.map((t) => t.url).sort()).toEqual(['https://a.com', 'https://b.com', 'https://c.com', 'https://d.com', 'https://e.com']);
  });
});

describe('write serialization without Web Locks', () => {
  beforeEach(() => resetChromeStorage());

  it('falls back to an in-context queue', async () => {
    const { vi } = await import('vitest');
    vi.stubGlobal('navigator', {});
    try {
      await Promise.all(Array.from({ length: 10 }, (_, i) => saveSession(session(`q${i + 1}`))));
      expect(await getSessions()).toHaveLength(10);
      // A failing write must not wedge the queue.
      vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'));
      await expect(saveSession(session('fails'))).rejects.toThrow('QUOTA_BYTES');
      await renameSession('q1', 'still works');
      expect((await getSessions()).find((s) => s.id === 'q1')?.name).toBe('still works');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
