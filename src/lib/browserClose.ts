import type { Session, SavedTab, SavedTabGroup, SnapTabsSettings } from './types';
import { uuid, formatSessionName, isExcludedUrl } from './types';
import { urlSetSignature, mergeGroups } from './tabs';
import {
  getSessions,
  saveSession,
  getPendingClose,
  savePendingClose,
  clearPendingClose,
  getLastSnapshot,
  clearLastSnapshot,
  hasSessionMarker,
  setSessionMarker,
} from './storage';

// Serializes work onto a single promise chain. Used to prevent concurrent
// chrome.windows.onRemoved callbacks from racing on the pending-close
// buffer (read-modify-write on chrome.storage.session) and on
// chrome.windows.getAll() observations.
export interface CloseChain {
  enqueue(fn: () => Promise<void>): void;
  drain(): Promise<void>;
}

export function createCloseChain(): CloseChain {
  let chain: Promise<void> = Promise.resolve();
  return {
    enqueue(fn) {
      chain = chain.then(fn).catch(() => {});
    },
    drain() {
      return chain;
    },
  };
}

export const PENDING_CLOSE_STALE_MS = 5000;

// Accumulates a normal (non-incognito) window's tabs and tab groups into the
// pending-close buffer; flushes a combined "Browser close" session when this
// was the last window. Caller is responsible for excluded-domain filtering
// and for guarding on settings.autoSnapshotOnBrowserClose.
export async function processNormalWindowClose(
  tabs: SavedTab[],
  groups: SavedTabGroup[],
  isLastWindow: boolean,
  now: number = Date.now(),
): Promise<Session | null> {
  let pending = await getPendingClose();
  if (now - pending.updatedAt > PENDING_CLOSE_STALE_MS) {
    pending = { tabs: [], groups: [], windowCount: 0, updatedAt: now };
  }
  pending.tabs.push(...tabs);
  pending.groups = mergeGroups(pending.groups, groups);
  pending.windowCount += 1;
  pending.updatedAt = now;
  await savePendingClose(pending);

  if (!isLastWindow || pending.tabs.length === 0) return null;

  const session: Session = {
    id: uuid(),
    name: formatSessionName('Browser close'),
    timestamp: now,
    tabs: pending.tabs,
    tabGroups: pending.groups,
    windowCount: pending.windowCount,
    hasIncognitoTabs: false,
    isAutoSave: true,
  };
  await saveSession(session);
  await clearPendingClose();
  await clearLastSnapshot();
  return session;
}

// Promotes a persisted last-known-good snapshot to a real session when the
// service worker starts in a fresh browser session (i.e. not a mid-session
// SW restart). Deduplicates against a recent matching auto-save so a
// successful in-handler save doesn't produce a duplicate.
export async function recoverLastSnapshot(settings: SnapTabsSettings): Promise<Session | null> {
  if (await hasSessionMarker()) return null;
  await setSessionMarker();

  if (!settings.autoSnapshotOnBrowserClose) {
    await clearLastSnapshot();
    return null;
  }

  const snap = await getLastSnapshot();
  if (!snap || snap.tabs.length === 0) return null;

  // Re-apply excluded-domain filtering in case the user added domains
  // between the snapshot write and this recovery.
  const filtered = settings.excludedDomains.length > 0
    ? snap.tabs.filter((t) => !isExcludedUrl(t.url, settings.excludedDomains))
    : snap.tabs;
  if (filtered.length === 0) {
    await clearLastSnapshot();
    return null;
  }

  // Dedupe against a recently-saved auto-save with the same URL set —
  // that means the in-handler close path already succeeded on quit.
  const sessions = await getSessions();
  const sig = urlSetSignature(filtered.map((t) => t.url));
  const recentMatch = sessions
    .filter(
      (s) =>
        s.isAutoSave &&
        !s.pinned &&
        s.timestamp >= snap.updatedAt - 60_000 &&
        urlSetSignature(s.tabs.map((t) => t.url)) === sig,
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (recentMatch) {
    await clearLastSnapshot();
    return null;
  }

  const session: Session = {
    id: uuid(),
    name: formatSessionName('Browser close (recovered)'),
    timestamp: snap.updatedAt,
    tabs: filtered,
    tabGroups: snap.groups,
    windowCount: snap.windowCount,
    hasIncognitoTabs: false,
    isAutoSave: true,
  };
  await saveSession(session);
  await clearLastSnapshot();
  return session;
}
