export interface SavedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  isIncognito: boolean;
  groupId?: number;
  index: number;
}

export interface SavedTabGroup {
  id: number;
  title: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
}

export interface Session {
  id: string;
  name: string;
  timestamp: number;
  tabs: SavedTab[];
  tabGroups: SavedTabGroup[];
  windowCount: number;
  hasIncognitoTabs: boolean;
  isAutoSave: boolean;
  pinned?: boolean;
}

export interface SnapTabsSettings {
  autoSnapshotOnClose: boolean;
  autoSnapshotOnBrowserClose: boolean;
  autoDeleteAfterRestore: boolean;
  maxSessions: number;
  showIncognitoWarning: boolean;
  restoreIncognitoToIncognito: boolean;
  restoreInNewWindow: boolean;
}

export const DEFAULT_SETTINGS: SnapTabsSettings = {
  autoSnapshotOnClose: false,
  autoSnapshotOnBrowserClose: true,
  autoDeleteAfterRestore: false,
  maxSessions: 50,
  showIncognitoWarning: true,
  restoreIncognitoToIncognito: true,
  restoreInNewWindow: false,
};

export interface LiveRecording {
  id: string;
  name: string;
  startedAt: number;
  windowId: number;
  tabs: SavedTab[];
  isActive: boolean;
}

export function formatSessionName(prefix: string): string {
  return `${prefix} - ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const BLOCKED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'moz-extension://',
  'about:',
  'edge://',
  'brave://',
] as const;

export const TAB_GROUP_COLORS: Record<string, string> = {
  blue: 'oklch(0.6 0.2 250)',
  red: 'oklch(0.6 0.2 25)',
  yellow: 'oklch(0.75 0.18 85)',
  green: 'oklch(0.65 0.18 145)',
  pink: 'oklch(0.65 0.2 330)',
  purple: 'oklch(0.6 0.2 290)',
  cyan: 'oklch(0.7 0.15 200)',
  orange: 'oklch(0.7 0.2 50)',
  grey: 'oklch(0.6 0.01 280)',
  gray: 'oklch(0.6 0.01 280)',
};
