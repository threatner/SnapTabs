import type { Session, SavedTab, SavedTabGroup } from './types';
import { uuid } from './types';
import { urlSetSignature } from './tabs';
import { replaceOrAddSession } from './storage';

// Save a tab group when the whole group is closed (docs/closed-groups/spec.md).
// Chrome can't show extensions a group after it's closed, so SnapTabs saves it
// as it happens. A close counts only when every tab of the group is removed
// in one burst (D11): ungrouping removes no tabs, closing tabs one by one
// spreads the removals out, and window closes are never reported here.

export const CLOSE_BURST_MS = 500;
// A lone tab closing is never "closing a group": it's also what the last
// step of closing a group's tabs one by one looks like (D18).
export const MIN_GROUP_TABS = 2;
export const SETTLE_MS = 600;
const FORGET_MS = 10_000;

interface Pending {
  tabs: SavedTab[];
  groupSize: number;
  first: number;
  last: number;
}

export function createClosedGroupTracker() {
  const pending = new Map<number, Pending>();
  return {
    // A tab that was in `groupId` was removed (not because its window closed).
    // `groupSize` is how many tabs the group had before the close.
    tabRemoved(groupId: number, tab: SavedTab, groupSize: number, now: number) {
      for (const [id, p] of pending) if (now - p.last > FORGET_MS) pending.delete(id);
      const p = pending.get(groupId) ?? { tabs: [], groupSize, first: now, last: now };
      p.tabs.push(tab);
      p.last = now;
      pending.set(groupId, p);
    },
    // Chrome reported the group gone; call this SETTLE_MS later. Returns the
    // group's tabs only if every one of them closed in a single burst.
    settle(groupId: number): SavedTab[] | null {
      const p = pending.get(groupId);
      pending.delete(groupId);
      if (!p || p.tabs.length < MIN_GROUP_TABS || p.tabs.length < p.groupSize || p.last - p.first > CLOSE_BURST_MS) return null;
      return p.tabs;
    },
  };
}

export function closedGroupSession(group: SavedTabGroup, tabs: SavedTab[], now = Date.now()): Session {
  return {
    id: uuid(),
    name: `${group.title.trim() || 'Unnamed group'} (closed group)`,
    timestamp: now,
    tabs: [...tabs].sort((a, b) => a.index - b.index).map((t, index) => ({ ...t, index, groupId: group.id })),
    tabGroups: [group],
    windowCount: 1,
    hasIncognitoTabs: false,
    isAutoSave: true,
  };
}

// Re-closing the same group with the same tabs replaces its earlier copy (D09).
export async function saveClosedGroup(session: Session): Promise<void> {
  const sig = urlSetSignature(session.tabs.map((t) => t.url));
  await replaceOrAddSession(session, (s) =>
    s.isAutoSave && !s.isBackup && s.name === session.name && urlSetSignature(s.tabs.map((t) => t.url)) === sig);
}
