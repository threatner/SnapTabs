import type { Session, SavedTab, SavedTabGroup } from './types';
import { uuid, isExcludedUrl } from './types';
import { captureWindow, isRestorable, mergeGroups, normalizeUrlForSig } from './tabs';
import { getSettings, getSessions, upsertBackup, takeBackupRestartCheck } from './storage';

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

// A backup overwrite that would drop at least this many tabs, and at least
// half of the backup, keeps the previous backup as its own session first
// (e.g. a big window closed by accident).
export const BIG_LOSS_MIN_TABS = 5;

function restorableUrls(tabs: SavedTab[]): Set<string> {
  return new Set(tabs.filter((t) => isRestorable(t.url)).map((t) => normalizeUrlForSig(t.url)));
}

// Whether overwriting `previous` with `next` should keep `previous` as its own
// session. After a browser restart any loss counts (the old backup may be all
// that's left of the crashed session); otherwise only a big loss does.
export function shouldKeepPrevious(previous: SavedTab[], next: SavedTab[], afterRestart: boolean): boolean {
  const before = restorableUrls(previous);
  const after = restorableUrls(next);
  let lost = 0;
  for (const u of before) if (!after.has(u)) lost++;
  if (lost === 0) return false;
  if (afterRestart) return true;
  return lost >= BIG_LOSS_MIN_TABS && lost * 2 >= before.size;
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
  // Consumed by the first backup attempt after a browser restart.
  const afterRestart = await takeBackupRestartCheck();
  if (existing && fingerprint(existing.tabs, existing.tabGroups) === fingerprint(tabs, groups)) return null;
  const keepPrevious = !!existing && shouldKeepPrevious(existing.tabs, tabs, afterRestart);

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
  await upsertBackup(session, keepPrevious);
  return session;
}
