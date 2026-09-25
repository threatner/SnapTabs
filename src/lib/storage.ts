import type { Session, SnapTabsSettings, LiveRecording, SavedTab, SavedTabGroup } from './types';
import { DEFAULT_SETTINGS, uuid, formatSessionName } from './types';

export const KEYS = {
  sessions: 'snaptabs_sessions',
  settings: 'snaptabs_settings',
  recording: 'snaptabs_live_recording',
  windowMap: 'snaptabs_window_map',
  windowCache: 'snaptabs_window_cache',
  pendingClose: 'snaptabs_pending_close',
  lastSnapshot: 'snaptabs_last_snapshot',
  sessionMarker: 'snaptabs_session_marker',
  meta: 'snaptabs_meta',
  backupRestartCheck: 'snaptabs_backup_restart_check',
  lastVersion: 'snaptabs_last_version',
} as const;

// Proactive per-window capture (tabs + tab groups), cached so auto-saves on
// browser/incognito close have a full snapshot — including group names — even
// after the window's tabs are gone.
export interface WindowCapture {
  tabs: SavedTab[];
  groups: SavedTabGroup[];
}

export interface PendingClose {
  tabs: SavedTab[];
  groups: SavedTabGroup[];
  windowCount: number;
  updatedAt: number;
}

// Last-known-good snapshot of all open non-incognito tabs, persisted to
// chrome.storage.local so it survives a service-worker termination during
// browser shutdown (observed on Brave). Promoted to a real session on the
// next fresh browser start if the in-handler save path didn't complete.
export interface LastSnapshot {
  tabs: SavedTab[];
  groups: SavedTabGroup[];
  windowCount: number;
  updatedAt: number;
}

// ── Write serialization ──
//
// Every write below is a read-modify-write of a whole storage key, and the
// writers run concurrently: service-worker timers and events, the popup, and
// the welcome page. Unserialized, they silently drop each other's changes
// (e.g. a backup refresh erasing a snapshot saved in the same instant). The
// Web Locks API is shared by all same-origin contexts, so one lock per key
// covers every extension page and the service worker.
const localQueues = new Map<string, Promise<unknown>>();

async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(`snaptabs:${name}`, fn) as Promise<T>;
  }
  // Fallback for environments without Web Locks: serialize within this context.
  const run = (localQueues.get(name) ?? Promise.resolve()).then(fn, fn);
  localQueues.set(name, run.catch(() => {}));
  return run;
}

// Usage counters that drive one-time prompts. Not part of export/import.
export interface Meta {
  restoreCount: number;
  ratingPromptDone: boolean;
}

const DEFAULT_META: Meta = { restoreCount: 0, ratingPromptDone: false };

// Successful restores before the popup asks for a rating.
export const RATING_PROMPT_AFTER_RESTORES = 3;

export async function getMeta(): Promise<Meta> {
  const result = await chrome.storage.local.get(KEYS.meta);
  return { ...DEFAULT_META, ...result[KEYS.meta] };
}

async function updateMeta(update: (meta: Meta) => Partial<Meta>): Promise<void> {
  await withLock(KEYS.meta, async () => {
    const current = await getMeta();
    await chrome.storage.local.set({ [KEYS.meta]: { ...current, ...update(current) } });
  });
}

export async function recordRestore(): Promise<void> {
  await updateMeta(({ restoreCount }) => ({ restoreCount: restoreCount + 1 }));
}

export async function dismissRatingPrompt(): Promise<void> {
  await updateMeta(() => ({ ratingPromptDone: true }));
}

export function shouldShowRatingPrompt(meta: Meta): boolean {
  return !meta.ratingPromptDone && meta.restoreCount >= RATING_PROMPT_AFTER_RESTORES;
}

// ── Sessions ──

export async function getSessions(): Promise<Session[]> {
  const result = await chrome.storage.local.get(KEYS.sessions);
  const sessions: Session[] = result[KEYS.sessions] ?? [];
  return sessions.sort(compareSessions);
}

function compareSessions(a: Session, b: Session): number {
  const pa = a.pinned ? 1 : 0;
  const pb = b.pinned ? 1 : 0;
  if (pa !== pb) return pb - pa;
  return b.timestamp - a.timestamp;
}

export async function saveSession(session: Session): Promise<void> {
  await withLock(KEYS.sessions, async () => {
    const result = await chrome.storage.local.get([KEYS.sessions, KEYS.settings]);
    const sessions: Session[] = result[KEYS.sessions] ?? [];
    const settings: SnapTabsSettings = { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
    sessions.push(session);
    enforceLimit(sessions, settings.maxSessions);
    await chrome.storage.local.set({ [KEYS.sessions]: sessions });
  });
}

// Turns a rolling backup into an ordinary auto-save named after the time it
// was taken (e.g. "Rolling backup - Sep 25, 3:10 PM").
// - rotated (a new backup takes over): new id, and unpinned so kept copies
//   stay prunable;
// - ended (backup turned off): same session, so id and pin are kept.
function retiredBackup(backup: Session, mode: 'rotated' | 'ended'): Session {
  const { isBackup: _, ...rest } = backup;
  return {
    ...rest,
    id: mode === 'rotated' ? uuid() : backup.id,
    name: formatSessionName(backup.name, new Date(backup.timestamp)),
    pinned: mode === 'rotated' ? undefined : backup.pinned,
    isAutoSave: true,
  };
}

// Replaces the rolling-backup session (there is only ever one). With
// `keepPrevious`, the current backup is first kept as an ordinary auto-save
// instead of being overwritten.
// Returns false (writing nothing) when the backup was turned off while this
// run was capturing tabs.
export async function upsertBackup(session: Session, keepPrevious = false): Promise<boolean> {
  return withLock(KEYS.sessions, async () => {
    const result = await chrome.storage.local.get([KEYS.sessions, KEYS.settings]);
    const all: Session[] = result[KEYS.sessions] ?? [];
    const settings: SnapTabsSettings = { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
    if (settings.autoBackupMinutes <= 0) return false;
    const sessions = all.filter((s) => !s.isBackup);
    const protect = new Set<string>();
    if (keepPrevious) {
      for (const old of all.filter((s) => s.isBackup)) {
        const kept = retiredBackup(old, 'rotated');
        sessions.push(kept);
        protect.add(kept.id);
      }
    }
    // Ids are unique; never let the backup take one another session holds.
    const id = sessions.some((s) => s.id === session.id) ? uuid() : session.id;
    sessions.push({ ...session, id, isBackup: true });
    enforceLimit(sessions, settings.maxSessions, protect);
    await chrome.storage.local.set({ [KEYS.sessions]: sessions });
    return true;
  });
}

// Ends the rolling backup (feature turned off): the last backup stays as an
// ordinary auto-save, so it is prunable and no longer marked as live.
export async function retireBackup(): Promise<void> {
  await withLock(KEYS.sessions, async () => {
    const result = await chrome.storage.local.get([KEYS.sessions, KEYS.settings]);
    const all: Session[] = result[KEYS.sessions] ?? [];
    if (!all.some((s) => s.isBackup)) return;
    const settings: SnapTabsSettings = { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
    const sessions = all.map((s) => (s.isBackup ? retiredBackup(s, 'ended') : s));
    const protect = new Set(all.filter((s) => s.isBackup).map((s) => s.id));
    enforceLimit(sessions, settings.maxSessions, protect);
    await chrome.storage.local.set({ [KEYS.sessions]: sessions });
  });
}

// Records the running extension version; returns true when it differs from
// the last one recorded (an update, or the first run of a version that
// tracks this). Chrome clears chrome.storage.session on extension updates as
// well as on browser restarts, so this tells the two apart.
export async function recordVersion(version: string): Promise<boolean> {
  const result = await chrome.storage.local.get(KEYS.lastVersion);
  if (result[KEYS.lastVersion] === version) return false;
  await chrome.storage.local.set({ [KEYS.lastVersion]: version });
  return true;
}

// Set on a fresh browser start: the first backup afterwards must not
// overwrite the pre-restart backup if that would lose tabs (crash recovery).
export async function setBackupRestartCheck(): Promise<void> {
  await chrome.storage.session.set({ [KEYS.backupRestartCheck]: true });
}

export async function takeBackupRestartCheck(): Promise<boolean> {
  const result = await chrome.storage.session.get(KEYS.backupRestartCheck);
  if (!result[KEYS.backupRestartCheck]) return false;
  await chrome.storage.session.remove(KEYS.backupRestartCheck);
  return true;
}

export async function renameSession(id: string, name: string): Promise<void> {
  await withLock(KEYS.sessions, async () => {
    const sessions = await getSessions();
    const session = sessions.find((s) => s.id === id);
    if (session) {
      session.name = name;
      await chrome.storage.local.set({ [KEYS.sessions]: sessions });
    }
  });
}

export async function togglePin(id: string): Promise<boolean> {
  return withLock(KEYS.sessions, async () => {
    const sessions = await getSessions();
    const session = sessions.find((s) => s.id === id);
    if (!session) return false;
    session.pinned = !session.pinned;
    await chrome.storage.local.set({ [KEYS.sessions]: sessions });
    return session.pinned;
  });
}

export async function deleteSession(id: string): Promise<void> {
  await withLock(KEYS.sessions, async () => {
    const sessions = await getSessions();
    await chrome.storage.local.set({
      [KEYS.sessions]: sessions.filter((s) => s.id !== id),
    });
  });
}

export async function deleteAllSessions(): Promise<void> {
  await withLock(KEYS.sessions, () => chrome.storage.local.set({ [KEYS.sessions]: [] }));
}

// ── Settings ──

export async function getSettings(): Promise<SnapTabsSettings> {
  const result = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
}

export async function updateSettings(partial: Partial<SnapTabsSettings>): Promise<void> {
  await withLock(KEYS.settings, async () => {
    const current = await getSettings();
    await chrome.storage.local.set({ [KEYS.settings]: { ...current, ...partial } });
  });
}

// ── Live Recording ──

export async function getRecording(): Promise<LiveRecording | null> {
  const result = await chrome.storage.session.get(KEYS.recording);
  return result[KEYS.recording] ?? null;
}

export async function startRecording(name: string, windowId: number): Promise<LiveRecording> {
  const recording: LiveRecording = {
    id: uuid(),
    name: name || formatSessionName('Recording'),
    startedAt: Date.now(),
    windowId,
    tabs: [],
    isActive: true,
  };
  await withLock(KEYS.recording, () => chrome.storage.session.set({ [KEYS.recording]: recording }));
  return recording;
}

export async function addTabToRecording(tab: SavedTab): Promise<LiveRecording | null> {
  return withLock(KEYS.recording, async () => {
    const recording = await getRecording();
    if (!recording?.isActive) return null;
    if (!recording.tabs.some((t) => t.url === tab.url)) {
      recording.tabs.push(tab);
      await chrome.storage.session.set({ [KEYS.recording]: recording });
    }
    return recording;
  });
}

export async function stopRecording(): Promise<Session | null> {
  // Under the recording lock so a tab still being added lands first.
  const recording = await withLock(KEYS.recording, async () => {
    const current = await getRecording();
    if (current) await chrome.storage.session.remove(KEYS.recording);
    return current;
  });
  if (!recording) return null;

  if (recording.tabs.length === 0) return null;

  const session: Session = {
    id: recording.id,
    name: recording.name,
    timestamp: recording.startedAt,
    tabs: recording.tabs,
    tabGroups: [],
    windowCount: 1,
    hasIncognitoTabs: recording.tabs.some((t) => t.isIncognito),
    isAutoSave: false,
  };
  await saveSession(session);
  return session;
}

export async function cancelRecording(): Promise<void> {
  await withLock(KEYS.recording, () => chrome.storage.session.remove(KEYS.recording));
}

// ── Window Map ──

export async function getWindowMap(): Promise<Record<number, boolean>> {
  const result = await chrome.storage.session.get(KEYS.windowMap);
  return result[KEYS.windowMap] ?? {};
}

export async function saveWindowMap(map: Record<number, boolean>): Promise<void> {
  await chrome.storage.session.set({ [KEYS.windowMap]: map });
}

// ── Window Cache ──
// Per-window proactive capture (tabs + tab groups). Keyed by window id.

export async function getWindowCache(): Promise<Record<string, WindowCapture>> {
  const result = await chrome.storage.session.get(KEYS.windowCache);
  return result[KEYS.windowCache] ?? {};
}

export async function saveWindowCache(cache: Record<string, WindowCapture>): Promise<void> {
  await chrome.storage.session.set({ [KEYS.windowCache]: cache });
}

// ── Pending Close Buffer ──
// Accumulates tabs from windows closed in rapid succession so that a Cmd+Q
// across multiple windows produces a single combined session.

export async function getPendingClose(): Promise<PendingClose> {
  const result = await chrome.storage.session.get(KEYS.pendingClose);
  const stored = result[KEYS.pendingClose] as Partial<PendingClose> | undefined;
  if (!stored) return { tabs: [], groups: [], windowCount: 0, updatedAt: 0 };
  return { groups: [], ...stored } as PendingClose;
}

export async function savePendingClose(data: PendingClose): Promise<void> {
  await chrome.storage.session.set({ [KEYS.pendingClose]: data });
}

export async function clearPendingClose(): Promise<void> {
  await chrome.storage.session.remove(KEYS.pendingClose);
}

// ── Last Snapshot (browser-close recovery) ──

export async function getLastSnapshot(): Promise<LastSnapshot | null> {
  const result = await chrome.storage.local.get(KEYS.lastSnapshot);
  const stored = result[KEYS.lastSnapshot] as Partial<LastSnapshot> | undefined;
  if (!stored) return null;
  return { groups: [], ...stored } as LastSnapshot;
}

export async function saveLastSnapshot(snap: LastSnapshot): Promise<void> {
  await chrome.storage.local.set({ [KEYS.lastSnapshot]: snap });
}

export async function clearLastSnapshot(): Promise<void> {
  await chrome.storage.local.remove(KEYS.lastSnapshot);
}

// Session marker lives in chrome.storage.session, which is wiped when the
// browser fully quits. If it is missing at SW startup, this is a fresh
// browser start (not a SW restart mid-session) and we should attempt
// last-snapshot recovery.
export async function hasSessionMarker(): Promise<boolean> {
  const result = await chrome.storage.session.get(KEYS.sessionMarker);
  return Boolean(result[KEYS.sessionMarker]);
}

export async function setSessionMarker(): Promise<void> {
  await chrome.storage.session.set({ [KEYS.sessionMarker]: true });
}

// ── Import / Export ──

export const EXPORT_VERSION = 1;

export interface ExportPayload {
  version: number;
  exportedAt: number;
  source: 'snaptabs';
  sessions: Session[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  renamed: number;
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const sessions = await getSessions();
  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    source: 'snaptabs',
    sessions,
  };
}

export async function importSessions(payload: unknown): Promise<ImportResult> {
  const validated = validateImportPayload(payload);
  return withLock(KEYS.sessions, () => mergeImported(validated));
}

async function mergeImported(validated: ExportPayload): Promise<ImportResult> {
  const result = await chrome.storage.local.get([KEYS.sessions, KEYS.settings]);
  const existing: Session[] = result[KEYS.sessions] ?? [];
  const settings: SnapTabsSettings = { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
  const byId = new Map(existing.map((s) => [s.id, s]));

  let imported = 0;
  let skipped = 0;
  let renamed = 0;

  for (const session of validated.sessions) {
    // An imported backup becomes an ordinary auto-save so there is never
    // more than one rolling backup.
    delete session.isBackup;
    const existingSession = byId.get(session.id);
    if (existingSession && existingSession.timestamp === session.timestamp) {
      skipped++;
      continue;
    }
    if (byId.has(session.id)) {
      session.id = uuid();
      renamed++;
    }
    existing.push(session);
    byId.set(session.id, session);
    imported++;
  }

  enforceLimit(existing, settings.maxSessions);
  await chrome.storage.local.set({ [KEYS.sessions]: existing });
  return { imported, skipped, renamed };
}

function validateImportPayload(data: unknown): ExportPayload {
  if (!data || typeof data !== 'object') throw new Error('Invalid file: not a JSON object');
  const d = data as Record<string, unknown>;
  if (d.source !== 'snaptabs') throw new Error('Not a SnapTabs export file');
  if (!Array.isArray(d.sessions)) throw new Error('Export file has no sessions');
  const sessions = d.sessions.filter(isValidSession);
  if (sessions.length === 0) throw new Error('No valid sessions found in file');
  return {
    version: typeof d.version === 'number' ? d.version : EXPORT_VERSION,
    exportedAt: typeof d.exportedAt === 'number' ? d.exportedAt : Date.now(),
    source: 'snaptabs',
    sessions,
  };
}

function isValidSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.timestamp === 'number' &&
    Array.isArray(s.tabs) &&
    Array.isArray(s.tabGroups) &&
    typeof s.windowCount === 'number' &&
    typeof s.hasIncognitoTabs === 'boolean' &&
    typeof s.isAutoSave === 'boolean'
  );
}

// ── Storage Usage ──

export async function getStorageUsage(): Promise<{ used: number; total: number }> {
  let used = 0;
  try {
    if (typeof chrome.storage.local.getBytesInUse === 'function') {
      used = await chrome.storage.local.getBytesInUse(null);
    }
  } catch { /* Firefox may not support getBytesInUse */ }
  return { used, total: chrome.storage.local.QUOTA_BYTES ?? 10_485_760 };
}

// ── Internal ──

// The rolling backup neither counts toward `max` nor gets pruned, so turning
// it on never evicts one of the user's sessions. `protect` shields sessions
// created by this very write (a kept backup copy carries the backup's older
// timestamp and would otherwise be the first auto-save pruned).
function enforceLimit(sessions: Session[], max: number, protect: ReadonlySet<string> = new Set()): void {
  sessions.sort((a, b) => a.timestamp - b.timestamp);
  const prunable = (s: Session) => !s.pinned && !s.isBackup && !protect.has(s.id);
  const counted = () => sessions.reduce((n, s) => n + (s.isBackup ? 0 : 1), 0);
  while (counted() > max) {
    let idx = sessions.findIndex((s) => s.isAutoSave && prunable(s));
    if (idx === -1) idx = sessions.findIndex(prunable);
    if (idx === -1) break;
    sessions.splice(idx, 1);
  }
  sessions.sort(compareSessions);
}
