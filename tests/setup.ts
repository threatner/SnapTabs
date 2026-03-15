import { vi } from 'vitest';

// Chrome storage mock state
const localStore: Record<string, unknown> = {};
const sessionStore: Record<string, unknown> = {};

function createStorageArea(store: Record<string, unknown>) {
  return {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys === null || keys === undefined) return { ...store };
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyList) {
        if (k in store) result[k] = store[k];
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) delete store[k];
    }),
    clear: vi.fn(async () => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    getBytesInUse: vi.fn(async () => JSON.stringify(store).length),
    QUOTA_BYTES: 10_485_760,
  };
}

const chromeLocal = createStorageArea(localStore);
const chromeSession = createStorageArea(sessionStore);

const chromeMock = {
  storage: {
    local: chromeLocal,
    session: chromeSession,
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(async () => []),
    create: vi.fn(async (opts: Record<string, unknown>) => ({
      id: Math.floor(Math.random() * 10000),
      windowId: opts.windowId ?? 1,
      ...opts,
    })),
    get: vi.fn(async (id: number) => ({ id, windowId: 1 })),
    update: vi.fn(async () => ({})),
    group: vi.fn(async () => Math.floor(Math.random() * 1000)),
  },
  tabGroups: {
    query: vi.fn(async () => []),
    update: vi.fn(async () => ({})),
    TAB_GROUP_ID_NONE: -1,
    ColorEnum: {} as Record<string, string>,
  },
  windows: {
    getAll: vi.fn(async () => []),
    create: vi.fn(async (opts: Record<string, unknown>) => ({
      id: Math.floor(Math.random() * 1000),
      incognito: opts.incognito ?? false,
      tabs: [{ id: Math.floor(Math.random() * 10000) }],
    })),
  },
  action: {
    setBadgeText: vi.fn(async () => {}),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  },
  runtime: {
    sendMessage: vi.fn(async () => ({})),
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
  },
  contextMenus: {
    removeAll: vi.fn(async () => {}),
    create: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
};

// Assign to global
Object.assign(globalThis, { chrome: chromeMock });

// Helper to reset storage state between tests
export function resetChromeStorage() {
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
}

export function getLocalStore() {
  return localStore;
}

export function getSessionStore() {
  return sessionStore;
}
