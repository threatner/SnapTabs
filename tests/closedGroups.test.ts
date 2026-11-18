import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from './setup';
import { createClosedGroupTracker, closedGroupSession, saveClosedGroup, CLOSE_BURST_MS } from '../src/lib/closedGroups';
import { getSessions, saveSession, updateSettings } from '../src/lib/storage';
import type { SavedTab, SavedTabGroup, Session } from '../src/lib/types';

const tab = (url: string, index: number, groupId = 7): SavedTab => ({ url, title: url, pinned: false, isIncognito: false, index, groupId, windowId: 1 });
const group = (title = 'Research'): SavedTabGroup => ({ id: 7, title, color: 'green' as chrome.tabGroups.ColorEnum, collapsed: true });

describe('closed-group detection', () => {
  it('a whole group closed in one burst is saved', () => {
    const t = createClosedGroupTracker();
    t.tabRemoved(7, tab('https://a.com', 0), 3, 1000);
    t.tabRemoved(7, tab('https://b.com', 1), 3, 1005);
    t.tabRemoved(7, tab('https://c.com', 2), 3, 1011);
    expect(t.settle(7)?.map((x) => x.url)).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
  });

  it('closing the tabs one by one is not a group close', () => {
    const t = createClosedGroupTracker();
    t.tabRemoved(7, tab('https://a.com', 0), 3, 1000);
    t.tabRemoved(7, tab('https://b.com', 1), 2, 1600);
    t.tabRemoved(7, tab('https://c.com', 2), 1, 2200);
    expect(t.settle(7)).toBeNull();
  });

  it('ungrouping (no tab removed) is not a group close', () => {
    expect(createClosedGroupTracker().settle(7)).toBeNull();
  });

  it('a group with some tabs still open is not a group close', () => {
    const t = createClosedGroupTracker();
    t.tabRemoved(7, tab('https://a.com', 0), 3, 1000);
    t.tabRemoved(7, tab('https://b.com', 1), 3, 1001);
    expect(t.settle(7)).toBeNull();
  });

  it('accepts a burst right at the limit and rejects one just over it', () => {
    const ok = createClosedGroupTracker();
    ok.tabRemoved(7, tab('https://a.com', 0), 2, 0);
    ok.tabRemoved(7, tab('https://b.com', 1), 2, CLOSE_BURST_MS);
    expect(ok.settle(7)).not.toBeNull();
    const late = createClosedGroupTracker();
    late.tabRemoved(7, tab('https://a.com', 0), 2, 0);
    late.tabRemoved(7, tab('https://b.com', 1), 2, CLOSE_BURST_MS + 1);
    expect(late.settle(7)).toBeNull();
  });

  it('keeps groups apart and settles each once', () => {
    const t = createClosedGroupTracker();
    t.tabRemoved(7, tab('https://a.com', 0, 7), 1, 1000);
    t.tabRemoved(8, tab('https://x.com', 0, 8), 1, 1000);
    expect(t.settle(7)?.length).toBe(1);
    expect(t.settle(7)).toBeNull();
    expect(t.settle(8)?.length).toBe(1);
  });

  it('forgets stray removals after a while', () => {
    const t = createClosedGroupTracker();
    t.tabRemoved(7, tab('https://a.com', 0), 1, 0);
    t.tabRemoved(8, tab('https://x.com', 0, 8), 1, 60_000);
    expect(t.settle(7)).toBeNull();
  });
});

describe('closedGroupSession', () => {
  it('names it after the group and keeps order, group and colour', () => {
    const s = closedGroupSession(group(), [tab('https://b.com', 5), tab('https://a.com', 2)], 1234);
    expect(s.name).toBe('Research (closed group)');
    expect(s.tabs.map((t) => [t.url, t.index, t.groupId])).toEqual([['https://a.com', 0, 7], ['https://b.com', 1, 7]]);
    expect(s.tabGroups).toEqual([group()]);
    expect(s).toMatchObject({ isAutoSave: true, windowCount: 1, timestamp: 1234, hasIncognitoTabs: false });
  });

  it('gives an unnamed group a readable name', () => {
    expect(closedGroupSession(group('  '), [tab('https://a.com', 0)]).name).toBe('Unnamed group (closed group)');
  });
});

describe('saveClosedGroup', () => {
  beforeEach(() => resetChromeStorage());

  it('re-closing the same group with the same tabs replaces the earlier copy', async () => {
    await saveClosedGroup(closedGroupSession(group(), [tab('https://a.com', 0), tab('https://b.com/', 1)], 1));
    await saveClosedGroup(closedGroupSession(group(), [tab('https://b.com', 0), tab('https://a.com', 1)], 2));
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].timestamp).toBe(2);
  });

  it('different tabs make a new session', async () => {
    await saveClosedGroup(closedGroupSession(group(), [tab('https://a.com', 0)], 1));
    await saveClosedGroup(closedGroupSession(group(), [tab('https://a.com', 0), tab('https://c.com', 1)], 2));
    expect(await getSessions()).toHaveLength(2);
  });

  it("never replaces a manual snapshot that happens to share the name", async () => {
    const manual: Session = { ...closedGroupSession(group(), [tab('https://a.com', 0)], 1), id: 'manual', isAutoSave: false };
    await saveSession(manual);
    await saveClosedGroup(closedGroupSession(group(), [tab('https://a.com', 0)], 2));
    expect((await getSessions()).map((s) => s.id)).toContain('manual');
    expect(await getSessions()).toHaveLength(2);
  });

  it('at the limit, prunes the oldest auto-save and never a manual snapshot', async () => {
    await updateSettings({ maxSessions: 2 });
    await saveSession({ ...closedGroupSession(group('Old'), [tab('https://z.com', 0)], 1), id: 'old-auto' });
    await saveSession({ ...closedGroupSession(group('Mine'), [tab('https://m.com', 0)], 2), id: 'manual', isAutoSave: false });
    await saveClosedGroup(closedGroupSession(group(), [tab('https://a.com', 0)], 3));
    const ids = (await getSessions()).map((s) => s.name);
    expect(ids).toContain('Research (closed group)');
    expect(ids).toContain('Mine (closed group)');
    expect(ids).not.toContain('Old (closed group)');
  });
});
