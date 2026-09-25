import type { Session, SavedTab, SavedTabGroup } from './types';
import { uuid, isExcludedUrl } from './types';
import { captureWindow, isRestorable, mergeGroups } from './tabs';
import { getSettings, getSessions, upsertBackup } from './storage';

// Rolling backup: a single session, refreshed on a chrome.alarms schedule,
// that always holds the current open tabs. Protects against crashes and
// accidentally closed windows without piling up a new session every time.
// Incognito windows are never included.

export const BACKUP_ALARM = 'snaptabs-backup';
export const BACKUP_NAME = 'Rolling backup';
export const BACKUP_INTERVALS = [0, 5, 15, 30, 60] as const;

// Creates, changes, or clears the backup alarm. Leaves an existing alarm with
// the right period alone: the service worker restarts often, and re-creating
// a periodic alarm on every start would keep pushing it back so it never fires.
export async function scheduleBackup(minutes: number): Promise<void> {
  const existing = await chrome.alarms.get(BACKUP_ALARM);
  if (minutes <= 0) {
    if (existing) await chrome.alarms.clear(BACKUP_ALARM);
    return;
  }
  if (existing?.periodInMinutes === minutes) return;
  await chrome.alarms.create(BACKUP_ALARM, { delayInMinutes: minutes, periodInMinutes: minutes });
}

// Order-sensitive fingerprint of everything a restore would reproduce, so an
// unchanged browser doesn't cause a storage write every interval.
function fingerprint(tabs: SavedTab[], groups: SavedTabGroup[]): string {
  return JSON.stringify([
    tabs.map((t) => [t.url, t.pinned, t.groupId ?? null, t.windowId ?? null, t.index]),
    groups.map((g) => [g.id, g.title, g.color, g.collapsed]),
  ]);
}

// Captures all normal (non-incognito) windows and writes them to the backup
// session. Returns the saved session, or null when nothing was written
// (backup off, nothing restorable open, or no change since the last backup).
export async function runBackup(now: number = Date.now()): Promise<Session | null> {
  const settings = await getSettings();
  if (settings.autoBackupMinutes <= 0) return null;

  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  let tabs: SavedTab[] = [];
  let groups: SavedTabGroup[] = [];
  let windowCount = 0;
  for (const w of windows) {
    if (w.incognito || w.id === undefined) continue;
    const cap = await captureWindow(w.id);
    const kept = cap.tabs.filter((t) => !isExcludedUrl(t.url, settings.excludedDomains));
    if (kept.length === 0) continue;
    tabs = tabs.concat(kept);
    groups = mergeGroups(groups, cap.groups);
    windowCount += 1;
  }
  if (!tabs.some((t) => isRestorable(t.url))) return null;

  const existing = (await getSessions()).find((s) => s.isBackup);
  if (existing && fingerprint(existing.tabs, existing.tabGroups) === fingerprint(tabs, groups)) return null;

  const session: Session = {
    id: existing?.id ?? uuid(),
    name: existing?.name ?? BACKUP_NAME,
    timestamp: now,
    tabs,
    tabGroups: groups,
    windowCount,
    hasIncognitoTabs: false,
    isAutoSave: true,
    isBackup: true,
    pinned: existing?.pinned,
  };
  await upsertBackup(session);
  return session;
}
