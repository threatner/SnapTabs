import type { Session, SnapTabsSettings, LiveRecording, SavedTab } from './types';
import { DEFAULT_SETTINGS, uuid, formatSessionName } from './types';

export const KEYS = {
  sessions: 'snaptabs_sessions',
  settings: 'snaptabs_settings',
  recording: 'snaptabs_live_recording',
  windowMap: 'snaptabs_window_map',
  incognitoCache: 'snaptabs_incognito_tab_cache',
} as const;

// ── Sessions ──

export async function getSessions(): Promise<Session[]> {
  const result = await chrome.storage.local.get(KEYS.sessions);
  const sessions: Session[] = result[KEYS.sessions] ?? [];
  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}

export async function saveSession(session: Session): Promise<void> {
  const result = await chrome.storage.local.get([KEYS.sessions, KEYS.settings]);
  const sessions: Session[] = result[KEYS.sessions] ?? [];
  const settings: SnapTabsSettings = { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
  sessions.push(session);
  enforceLimit(sessions, settings.maxSessions);
  await chrome.storage.local.set({ [KEYS.sessions]: sessions });
}

export async function renameSession(id: string, name: string): Promise<void> {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.name = name;
    await chrome.storage.local.set({ [KEYS.sessions]: sessions });
  }
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions();
  await chrome.storage.local.set({
    [KEYS.sessions]: sessions.filter((s) => s.id !== id),
  });
}

export async function deleteAllSessions(): Promise<void> {
  await chrome.storage.local.set({ [KEYS.sessions]: [] });
}

// ── Settings ──

export async function getSettings(): Promise<SnapTabsSettings> {
  const result = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
}

export async function updateSettings(partial: Partial<SnapTabsSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEYS.settings]: { ...current, ...partial } });
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
  await chrome.storage.session.set({ [KEYS.recording]: recording });
  return recording;
}

export async function addTabToRecording(tab: SavedTab): Promise<LiveRecording | null> {
  const recording = await getRecording();
  if (!recording?.isActive) return null;
  if (!recording.tabs.some((t) => t.url === tab.url)) {
    recording.tabs.push(tab);
    await chrome.storage.session.set({ [KEYS.recording]: recording });
  }
  return recording;
}

export async function stopRecording(): Promise<Session | null> {
  const recording = await getRecording();
  if (!recording) return null;

  await chrome.storage.session.remove(KEYS.recording);

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
  await chrome.storage.session.remove(KEYS.recording);
}

// ── Window Map ──

export async function getWindowMap(): Promise<Record<number, boolean>> {
  const result = await chrome.storage.session.get(KEYS.windowMap);
  return result[KEYS.windowMap] ?? {};
}

export async function saveWindowMap(map: Record<number, boolean>): Promise<void> {
  await chrome.storage.session.set({ [KEYS.windowMap]: map });
}

// ── Incognito Cache ──

export async function getIncognitoCache(): Promise<Record<string, SavedTab[]>> {
  const result = await chrome.storage.session.get(KEYS.incognitoCache);
  return result[KEYS.incognitoCache] ?? {};
}

export async function saveIncognitoCache(cache: Record<string, SavedTab[]>): Promise<void> {
  await chrome.storage.session.set({ [KEYS.incognitoCache]: cache });
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
  const result = await chrome.storage.local.get([KEYS.sessions, KEYS.settings]);
  const existing: Session[] = result[KEYS.sessions] ?? [];
  const settings: SnapTabsSettings = { ...DEFAULT_SETTINGS, ...result[KEYS.settings] };
  const byId = new Map(existing.map((s) => [s.id, s]));

  let imported = 0;
  let skipped = 0;
  let renamed = 0;

  for (const session of validated.sessions) {
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

function enforceLimit(sessions: Session[], max: number): void {
  sessions.sort((a, b) => a.timestamp - b.timestamp);
  while (sessions.length > max) {
    const autoIdx = sessions.findIndex((s) => s.isAutoSave);
    sessions.splice(autoIdx !== -1 ? autoIdx : 0, 1);
  }
  sessions.sort((a, b) => b.timestamp - a.timestamp);
}
