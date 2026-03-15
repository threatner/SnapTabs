import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage, getLocalStore, getSessionStore } from './setup';
import {
  KEYS,
  getSessions,
  saveSession,
  renameSession,
  deleteSession,
  deleteAllSessions,
  getSettings,
  updateSettings,
  getRecording,
  startRecording,
  addTabToRecording,
  stopRecording,
  cancelRecording,
  getWindowMap,
  saveWindowMap,
  getIncognitoCache,
  saveIncognitoCache,
  getStorageUsage,
} from '../src/lib/storage';
import type { Session, SavedTab } from '../src/lib/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    name: 'Test Session',
    timestamp: Date.now(),
    tabs: [],
    tabGroups: [],
    windowCount: 1,
    hasIncognitoTabs: false,
    isAutoSave: false,
    ...overrides,
  };
}

function makeTab(overrides: Partial<SavedTab> = {}): SavedTab {
  return {
    url: 'https://example.com',
    title: 'Example',
    pinned: false,
    isIncognito: false,
    index: 0,
    ...overrides,
  };
}

describe('Sessions', () => {
  beforeEach(() => resetChromeStorage());

  it('returns empty array when no sessions exist', async () => {
    const sessions = await getSessions();
    expect(sessions).toEqual([]);
  });

  it('saves and retrieves a session', async () => {
    const session = makeSession({ name: 'My Session' });
    await saveSession(session);
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe('My Session');
  });

  it('returns sessions sorted newest first', async () => {
    const old = makeSession({ id: 'old', name: 'Old', timestamp: 1000 });
    const mid = makeSession({ id: 'mid', name: 'Mid', timestamp: 2000 });
    const recent = makeSession({ id: 'recent', name: 'Recent', timestamp: 3000 });

    await saveSession(old);
    await saveSession(mid);
    await saveSession(recent);

    const sessions = await getSessions();
    expect(sessions.map((s) => s.name)).toEqual(['Recent', 'Mid', 'Old']);
  });

  it('enforces maxSessions limit by removing oldest auto-saves first', async () => {
    // Set max to 2
    await updateSettings({ maxSessions: 2 });

    const auto1 = makeSession({ id: 'auto1', name: 'Auto 1', timestamp: 1000, isAutoSave: true });
    const manual = makeSession({ id: 'manual', name: 'Manual', timestamp: 2000, isAutoSave: false });
    const auto2 = makeSession({ id: 'auto2', name: 'Auto 2', timestamp: 3000, isAutoSave: true });

    await saveSession(auto1);
    await saveSession(manual);
    await saveSession(auto2);

    const sessions = await getSessions();
    expect(sessions).toHaveLength(2);
    // auto1 (oldest auto-save) should be removed
    expect(sessions.find((s) => s.id === 'auto1')).toBeUndefined();
    expect(sessions.find((s) => s.id === 'manual')).toBeDefined();
    expect(sessions.find((s) => s.id === 'auto2')).toBeDefined();
  });

  it('renames a session', async () => {
    const session = makeSession({ id: 'rename-me', name: 'Original' });
    await saveSession(session);
    await renameSession('rename-me', 'Renamed');
    const sessions = await getSessions();
    expect(sessions[0].name).toBe('Renamed');
  });

  it('rename does nothing for nonexistent id', async () => {
    const session = makeSession({ name: 'Keep' });
    await saveSession(session);
    await renameSession('nonexistent', 'New Name');
    const sessions = await getSessions();
    expect(sessions[0].name).toBe('Keep');
  });

  it('deletes a session', async () => {
    const s1 = makeSession({ id: 'keep' });
    const s2 = makeSession({ id: 'delete-me' });
    await saveSession(s1);
    await saveSession(s2);
    await deleteSession('delete-me');
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('keep');
  });

  it('deletes all sessions', async () => {
    await saveSession(makeSession({ id: 's1' }));
    await saveSession(makeSession({ id: 's2' }));
    await deleteAllSessions();
    const sessions = await getSessions();
    expect(sessions).toEqual([]);
  });
});

describe('Settings', () => {
  beforeEach(() => resetChromeStorage());

  it('returns defaults when nothing is stored', async () => {
    const settings = await getSettings();
    expect(settings.autoSnapshotOnClose).toBe(false);
    expect(settings.maxSessions).toBe(50);
    expect(settings.showIncognitoWarning).toBe(true);
  });

  it('merges stored values with defaults', async () => {
    await updateSettings({ autoSnapshotOnClose: true });
    const settings = await getSettings();
    expect(settings.autoSnapshotOnClose).toBe(true);
    expect(settings.maxSessions).toBe(50); // still default
  });

  it('updates partial settings without overwriting others', async () => {
    await updateSettings({ maxSessions: 100 });
    await updateSettings({ autoDeleteAfterRestore: true });
    const settings = await getSettings();
    expect(settings.maxSessions).toBe(100);
    expect(settings.autoDeleteAfterRestore).toBe(true);
  });
});

describe('Live Recording', () => {
  beforeEach(() => resetChromeStorage());

  it('returns null when no recording exists', async () => {
    const rec = await getRecording();
    expect(rec).toBeNull();
  });

  it('starts a recording', async () => {
    const rec = await startRecording('My Recording', 42);
    expect(rec.name).toBe('My Recording');
    expect(rec.windowId).toBe(42);
    expect(rec.isActive).toBe(true);
    expect(rec.tabs).toEqual([]);
  });

  it('uses default name when empty string provided', async () => {
    const rec = await startRecording('', 1);
    expect(rec.name).toContain('Recording');
  });

  it('adds tabs to recording (deduplicates by URL)', async () => {
    await startRecording('Test', 1);

    const tab1 = makeTab({ url: 'https://a.com' });
    const tab2 = makeTab({ url: 'https://b.com' });
    const duplicate = makeTab({ url: 'https://a.com', title: 'A (duplicate)' });

    await addTabToRecording(tab1);
    await addTabToRecording(tab2);
    await addTabToRecording(duplicate);

    const rec = await getRecording();
    expect(rec!.tabs).toHaveLength(2);
  });

  it('returns null when adding to inactive recording', async () => {
    const result = await addTabToRecording(makeTab());
    expect(result).toBeNull();
  });

  it('stops recording and creates a session', async () => {
    await startRecording('Test Recording', 1);
    await addTabToRecording(makeTab({ url: 'https://example.com' }));

    const session = await stopRecording();
    expect(session).not.toBeNull();
    expect(session!.name).toBe('Test Recording');
    expect(session!.tabs).toHaveLength(1);

    // Recording should be cleared
    const rec = await getRecording();
    expect(rec).toBeNull();

    // Session should be saved
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
  });

  it('returns null when stopping empty recording', async () => {
    await startRecording('Empty', 1);
    const session = await stopRecording();
    expect(session).toBeNull();
  });

  it('cancels recording without saving', async () => {
    await startRecording('Cancel Me', 1);
    await addTabToRecording(makeTab());
    await cancelRecording();

    const rec = await getRecording();
    expect(rec).toBeNull();

    const sessions = await getSessions();
    expect(sessions).toEqual([]);
  });
});

describe('Window Map', () => {
  beforeEach(() => resetChromeStorage());

  it('returns empty object when nothing stored', async () => {
    const map = await getWindowMap();
    expect(map).toEqual({});
  });

  it('saves and retrieves window map', async () => {
    await saveWindowMap({ 1: true, 2: false });
    const map = await getWindowMap();
    expect(map).toEqual({ 1: true, 2: false });
  });
});

describe('Incognito Cache', () => {
  beforeEach(() => resetChromeStorage());

  it('returns empty object when nothing stored', async () => {
    const cache = await getIncognitoCache();
    expect(cache).toEqual({});
  });

  it('saves and retrieves incognito cache', async () => {
    const tabs = [makeTab({ isIncognito: true })];
    await saveIncognitoCache({ '42': tabs });
    const cache = await getIncognitoCache();
    expect(cache['42']).toHaveLength(1);
    expect(cache['42'][0].isIncognito).toBe(true);
  });
});

describe('Storage Usage', () => {
  beforeEach(() => resetChromeStorage());

  it('returns usage stats', async () => {
    const usage = await getStorageUsage();
    expect(usage).toHaveProperty('used');
    expect(usage).toHaveProperty('total');
    expect(usage.total).toBe(10_485_760);
  });
});
