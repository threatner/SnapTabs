import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import {
  createCloseChain,
  processNormalWindowClose,
  recoverLastSnapshot,
  PENDING_CLOSE_STALE_MS,
} from '../src/lib/browserClose';
import {
  getPendingClose,
  getSessions,
  saveSession,
  saveLastSnapshot,
  getLastSnapshot,
  setSessionMarker,
  clearLastSnapshot,
  updateSettings,
  getSettings,
} from '../src/lib/storage';
import type { SavedTab, Session, SnapTabsSettings } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/types';

function tab(url: string, overrides: Partial<SavedTab> = {}): SavedTab {
  return {
    url,
    title: url,
    pinned: false,
    isIncognito: false,
    index: 0,
    ...overrides,
  };
}

function settingsWith(overrides: Partial<SnapTabsSettings> = {}): SnapTabsSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('createCloseChain', () => {
  it('runs enqueued work sequentially in submission order', async () => {
    const chain = createCloseChain();
    const order: number[] = [];

    chain.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    chain.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push(2);
    });
    chain.enqueue(async () => {
      order.push(3);
    });

    await chain.drain();
    expect(order).toEqual([1, 2, 3]);
  });

  it('continues processing after a task throws', async () => {
    const chain = createCloseChain();
    const order: string[] = [];

    chain.enqueue(async () => {
      throw new Error('boom');
    });
    chain.enqueue(async () => {
      order.push('after-error');
    });

    await chain.drain();
    expect(order).toEqual(['after-error']);
  });
});

describe('processNormalWindowClose', () => {
  beforeEach(() => resetChromeStorage());

  it('appends tabs to pending buffer and does not save when not last window', async () => {
    const result = await processNormalWindowClose([tab('https://a.com')], false, 1000);
    expect(result).toBeNull();

    const pending = await getPendingClose();
    expect(pending.tabs).toHaveLength(1);
    expect(pending.tabs[0].url).toBe('https://a.com');
    expect(pending.windowCount).toBe(1);
  });

  it('flushes pending buffer to a session when last window closes', async () => {
    await processNormalWindowClose([tab('https://a.com')], false, 1000);
    await processNormalWindowClose([tab('https://b.com'), tab('https://c.com')], false, 1100);
    const session = await processNormalWindowClose([tab('https://d.com')], true, 1200);

    expect(session).not.toBeNull();
    expect(session!.tabs).toHaveLength(4);
    expect(session!.tabs.map((t) => t.url)).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
      'https://d.com',
    ]);
    expect(session!.windowCount).toBe(3);
    expect(session!.isAutoSave).toBe(true);
    expect(session!.name).toMatch(/^Browser close/);

    // Buffer cleared after flush
    const pending = await getPendingClose();
    expect(pending.tabs).toEqual([]);
    expect(pending.windowCount).toBe(0);

    // Session persisted
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tabs).toHaveLength(4);
  });

  it('resets pending buffer if it is older than the stale window', async () => {
    await processNormalWindowClose([tab('https://stale.com')], false, 1000);
    const fresh = await processNormalWindowClose(
      [tab('https://fresh.com')],
      true,
      1000 + PENDING_CLOSE_STALE_MS + 1,
    );
    expect(fresh).not.toBeNull();
    expect(fresh!.tabs).toHaveLength(1);
    expect(fresh!.tabs[0].url).toBe('https://fresh.com');
  });

  it('clears lastSnapshot when it saves a session', async () => {
    await saveLastSnapshot({ tabs: [tab('https://x.com')], windowCount: 1, updatedAt: 1 });
    await processNormalWindowClose([tab('https://a.com')], true, 1000);
    const snap = await getLastSnapshot();
    expect(snap).toBeNull();
  });

  it('serialized via createCloseChain: concurrent multi-window close keeps all tabs', async () => {
    // This is the race we fixed: without serialization, three concurrent
    // callbacks read pending={tabs:[]} and the last savePendingClose wins.
    const chain = createCloseChain();
    const w1 = [tab('https://w1-a.com'), tab('https://w1-b.com')];
    const w2 = [tab('https://w2-a.com')];
    const w3 = [tab('https://w3-a.com'), tab('https://w3-b.com'), tab('https://w3-c.com')];

    let last: Session | null = null;
    chain.enqueue(async () => {
      await processNormalWindowClose(w1, false, 1000);
    });
    chain.enqueue(async () => {
      await processNormalWindowClose(w2, false, 1001);
    });
    chain.enqueue(async () => {
      last = await processNormalWindowClose(w3, true, 1002);
    });

    await chain.drain();
    expect(last).not.toBeNull();
    expect(last!.tabs).toHaveLength(6);
    expect(last!.windowCount).toBe(3);
    const urls = last!.tabs.map((t) => t.url).sort();
    expect(urls).toEqual([
      'https://w1-a.com',
      'https://w1-b.com',
      'https://w2-a.com',
      'https://w3-a.com',
      'https://w3-b.com',
      'https://w3-c.com',
    ]);
  });

  it('without serialization, concurrent close races drop tabs (sanity check)', async () => {
    // Demonstrates why createCloseChain matters. Without the mutex, three
    // concurrent processNormalWindowClose calls each read the same empty
    // buffer and write back competing values.
    const w1 = [tab('https://w1.com')];
    const w2 = [tab('https://w2.com')];
    const w3 = [tab('https://w3.com')];

    await Promise.all([
      processNormalWindowClose(w1, false, 1000),
      processNormalWindowClose(w2, false, 1000),
      processNormalWindowClose(w3, true, 1000),
    ]);

    const sessions = await getSessions();
    // Race produces fewer than 3 unique tabs in the saved session.
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tabs.length).toBeLessThan(3);
  });
});

describe('recoverLastSnapshot', () => {
  beforeEach(() => resetChromeStorage());

  it('returns null and does nothing when sessionMarker already set', async () => {
    await setSessionMarker();
    await saveLastSnapshot({ tabs: [tab('https://x.com')], windowCount: 1, updatedAt: 1 });
    const result = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: true }));
    expect(result).toBeNull();
    // lastSnapshot left intact for the next genuine fresh start
    const snap = await getLastSnapshot();
    expect(snap).not.toBeNull();
  });

  it('clears lastSnapshot and returns null when feature disabled', async () => {
    await saveLastSnapshot({ tabs: [tab('https://x.com')], windowCount: 1, updatedAt: 1 });
    const result = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: false }));
    expect(result).toBeNull();
    const snap = await getLastSnapshot();
    expect(snap).toBeNull();
  });

  it('promotes lastSnapshot to a session on a fresh browser start', async () => {
    await saveLastSnapshot({
      tabs: [tab('https://a.com'), tab('https://b.com')],
      windowCount: 2,
      updatedAt: 5000,
    });
    const result = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: true }));
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(2);
    expect(result!.windowCount).toBe(2);
    expect(result!.isAutoSave).toBe(true);
    expect(result!.name).toMatch(/Browser close \(recovered\)/);
    expect(result!.timestamp).toBe(5000);

    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toMatch(/recovered/);
    const snap = await getLastSnapshot();
    expect(snap).toBeNull();
  });

  it('dedupes against a recent auto-save with the same URL set', async () => {
    // Simulate the happy path: onRemoved succeeded on quit and saved a
    // session, then SW died before clearing lastSnapshot. Recovery should
    // NOT create a duplicate.
    const tabs = [tab('https://a.com'), tab('https://b.com')];
    const existing: Session = {
      id: 'existing',
      name: 'Browser close - May 26',
      timestamp: 10_000,
      tabs,
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: true,
    };
    await saveSession(existing);
    await saveLastSnapshot({ tabs, windowCount: 1, updatedAt: 9_900 });

    const result = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: true }));
    expect(result).toBeNull();

    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    const snap = await getLastSnapshot();
    expect(snap).toBeNull();
  });

  it('promotes when the most recent auto-save has a DIFFERENT URL set', async () => {
    const existing: Session = {
      id: 'unrelated',
      name: 'Browser close - earlier',
      timestamp: 9_500,
      tabs: [tab('https://different.com')],
      tabGroups: [],
      windowCount: 1,
      hasIncognitoTabs: false,
      isAutoSave: true,
    };
    await saveSession(existing);
    await saveLastSnapshot({
      tabs: [tab('https://a.com'), tab('https://b.com')],
      windowCount: 1,
      updatedAt: 10_000,
    });

    const result = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: true }));
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(2);
  });

  it('applies excluded-domain filter at recovery time', async () => {
    await saveLastSnapshot({
      tabs: [tab('https://keep.com'), tab('https://drop.com')],
      windowCount: 1,
      updatedAt: 5_000,
    });
    const result = await recoverLastSnapshot(
      settingsWith({ autoSnapshotOnBrowserClose: true, excludedDomains: ['drop.com'] }),
    );
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].url).toBe('https://keep.com');
  });

  it('returns null when filter empties the snapshot', async () => {
    await saveLastSnapshot({
      tabs: [tab('https://drop.com')],
      windowCount: 1,
      updatedAt: 5_000,
    });
    const result = await recoverLastSnapshot(
      settingsWith({ autoSnapshotOnBrowserClose: true, excludedDomains: ['drop.com'] }),
    );
    expect(result).toBeNull();
    const snap = await getLastSnapshot();
    expect(snap).toBeNull();
  });

  it('idempotent: a second call within the same browser session is a no-op', async () => {
    await saveLastSnapshot({ tabs: [tab('https://a.com')], windowCount: 1, updatedAt: 5_000 });
    const first = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: true }));
    expect(first).not.toBeNull();
    const second = await recoverLastSnapshot(settingsWith({ autoSnapshotOnBrowserClose: true }));
    expect(second).toBeNull();
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
  });
});

describe('storage: lastSnapshot and sessionMarker round-trips', () => {
  beforeEach(() => resetChromeStorage());

  it('saveLastSnapshot / getLastSnapshot / clearLastSnapshot', async () => {
    expect(await getLastSnapshot()).toBeNull();
    await saveLastSnapshot({ tabs: [tab('https://a.com')], windowCount: 1, updatedAt: 42 });
    const got = await getLastSnapshot();
    expect(got).toEqual({ tabs: [tab('https://a.com')], windowCount: 1, updatedAt: 42 });
    await clearLastSnapshot();
    expect(await getLastSnapshot()).toBeNull();
  });

  it('lastSnapshot lives in chrome.storage.local (survives session wipe)', async () => {
    await saveLastSnapshot({ tabs: [], windowCount: 0, updatedAt: 1 });
    // recovery flow uses chrome.storage.session for the marker; the
    // snapshot itself MUST be in local so it survives browser quit.
    const { snaptabs_last_snapshot } = await chrome.storage.local.get('snaptabs_last_snapshot');
    expect(snaptabs_last_snapshot).toBeDefined();
  });

  it('autoSnapshotOnBrowserClose can be enabled via updateSettings and is read back', async () => {
    await updateSettings({ autoSnapshotOnBrowserClose: true });
    const settings = await getSettings();
    expect(settings.autoSnapshotOnBrowserClose).toBe(true);
  });
});
