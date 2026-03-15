import type { BrowserContext } from '@playwright/test';
import type { Session, SavedTab, SavedTabGroup, SnapTabsSettings } from '../../src/lib/types';
import { DEFAULT_SETTINGS } from '../../src/lib/types';
import { KEYS } from '../../src/lib/storage';

export type { Session, SavedTab, SavedTabGroup, SnapTabsSettings };

export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Session',
    timestamp: Date.now(),
    tabs: [
      { url: 'https://example.com', title: 'Example', pinned: false, isIncognito: false, index: 0 },
      { url: 'https://github.com', title: 'GitHub', pinned: false, isIncognito: false, index: 1 },
    ],
    tabGroups: [],
    windowCount: 1,
    hasIncognitoTabs: false,
    isAutoSave: false,
    ...overrides,
  };
}

export function createMockSessionWithGroups(): Session {
  return createMockSession({
    name: 'Grouped Session',
    tabs: [
      { url: 'https://react.dev', title: 'React', pinned: false, isIncognito: false, groupId: 1, index: 0 },
      { url: 'https://svelte.dev', title: 'Svelte', pinned: false, isIncognito: false, groupId: 1, index: 1 },
      { url: 'https://news.ycombinator.com', title: 'HN', pinned: false, isIncognito: false, index: 2 },
    ],
    tabGroups: [
      { id: 1, title: 'Frameworks', color: 'blue' as chrome.tabGroups.ColorEnum, collapsed: false },
    ],
  });
}

export async function getServiceWorker(context: BrowserContext) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return sw;
}

export async function seedSessions(context: BrowserContext, sessions: Session[]): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate((data: { key: string; sessions: unknown[] }) => {
    return chrome.storage.local.set({ [data.key]: data.sessions });
  }, { key: KEYS.sessions, sessions });
}

export async function seedSettings(context: BrowserContext, settings: Partial<SnapTabsSettings>): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate((data: { key: string; settings: unknown }) => {
    return chrome.storage.local.set({ [data.key]: data.settings });
  }, { key: KEYS.settings, settings: { ...DEFAULT_SETTINGS, ...settings } });
}

export async function clearStorage(context: BrowserContext): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(() => chrome.storage.local.clear());
}
