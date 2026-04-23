# CLAUDE.md - SnapTabs

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev            # WXT dev server with hot reload (Chrome)
npm run build          # Production build → .output/chrome-mv3/
npm run zip            # Package as .zip for distribution
npm test               # Run unit tests (vitest)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run test:e2e       # Run E2E tests (Playwright, requires build first)
npm run test:e2e:debug # Run E2E tests in debug mode
```

## What is SnapTabs

SnapTabs is a Chrome extension (Manifest V3) that snapshots and restores browser tabs, including tab groups, pinned tabs, and incognito tabs. Built with **Svelte 5**, **WXT 0.19**, **Tailwind CSS 4**, and **TypeScript**.

### Features

- **Manual snapshot**: save all open tabs from the current window or all windows with one click. Optional custom name, keyboard shortcut (`Alt+Shift+S`), and right-click context menu.
- **Tab group preservation**: captures and restores tab group names, colors, and collapsed state.
- **Incognito support**: captures incognito tabs (when the extension is enabled in incognito mode) and restores them to incognito windows. Proactive caching ensures tabs are captured before the window closes.
- **Auto-snapshot on browser close** (default ON): when the last window closes, SnapTabs saves the session as an auto-save named `Browser close - <date>`. Multi-window Cmd+Q is handled via a pending-close buffer persisted to `chrome.storage.session` with a 5-second staleness window, which accumulates each closing window's cached tabs and flushes a single combined session when `remaining.length === 0`.
- **Auto-save on incognito close**: optionally auto-save incognito tabs when an incognito window is closed. Uses the same proactive tab cache.
- **Live recording**: record new tabs as they open in a window (or all windows), then save the session. URL deduplication, pulsing badge indicator, real-time tab count.
- **Session restore**: restore to current window or a new window. Incognito tabs go to an incognito window when the setting is enabled. Auto-delete after restore is optional.
- **Session pinning**: pin sessions so they sort to the top and are exempt from auto-pruning. Available via the card context menu and the detail-view toolbar button.
- **Import / Export**: download all sessions to a JSON file (`snaptabs-export-YYYY-MM-DD.json`) or load from a previous export. Import handles ID collisions by renaming on conflict and skipping exact re-imports (same id + timestamp).
- **Omnibox search**: `st <query>` in Chrome's address bar fuzzy-matches tab titles and URLs across every saved session. Selecting a suggestion opens the tab (Alt+Enter for new tab); raw text with no selection falls back to Google search.
- **Search** (popup): real-time filter across session names, tab titles, and URLs.
- **Storage management**: 10 MB quota with automatic pruning (oldest auto-saves removed first, pinned sessions never pruned). Configurable session limit (1-500). Storage usage bar in settings.
- **Settings**: 7 options: auto-snapshot on browser close (default true), auto-save on incognito close, auto-delete after restore, restore private to private, restore in new window, show incognito warning, max sessions limit.

### Permissions (minimal set)

| Permission | Why |
|---|---|
| `tabs` | Query and create tabs for snapshot and restore |
| `tabGroups` | Read and recreate tab group names, colors, and state |
| `storage` | Persist sessions and settings locally |
| `contextMenus` | Right-click "Save all tabs" option |

Requires Chrome 93+ (`minimum_chrome_version`). Incognito mode: `"spanning"`.

## Architecture

### Extension Structure

```
Popup (Svelte UI)  ──sendMessage──►  Background (Service Worker)
                                          │
                                     Chrome APIs
                                    (tabs, windows,
                                     storage, tabGroups)
```

**Critical constraint**: All tab-creating operations (restore, snapshot) MUST go through the background service worker via `chrome.runtime.sendMessage()`. The popup closes the instant Chrome creates or focuses a tab, so calling `chrome.tabs.create()` directly from the popup will fail silently.

### Data Flow

- **Popup → Background**: Message protocol with action strings (`'snapshot'`, `'restore'`, `'delete'`, `'togglePin'`, `'startRecording'`, `'stopRecording'`, `'cancelRecording'`, `'getSessions'`, `'getStats'`, `'getSettings'`, `'updateSettings'`, `'getRecording'`). Import/export is invoked directly from the popup (no message round-trip needed).
- **Background → Storage**: `chrome.storage.local` for persistent data (sessions, settings), `chrome.storage.session` for ephemeral data (live recording, window map, proactive per-window tab cache, pending-close buffer).
- **Storage quota**: 10 MB. Automatic pruning removes oldest auto-saves first when `maxSessions` is exceeded; pinned sessions are skipped. If all prunable sessions are pinned, `enforceLimit` breaks out and the list is allowed to exceed `maxSessions` as a soft cap.
- **Omnibox**: `chrome.omnibox` `onInputChanged` / `onInputEntered` handlers live in `background.ts`. Suggestions are ranked by (title match 100 + url match 40 + session-name match 10 + pinned bonus 5), capped at 8 results, deduped by URL.

### Key Modules

- `src/lib/types.ts`: all interfaces (`Session` including optional `pinned`, `SavedTab`, `SavedTabGroup`, `SnapTabsSettings`, `LiveRecording`), shared constants (`DEFAULT_SETTINGS`, `BLOCKED_URL_PREFIXES`, `TAB_GROUP_COLORS`), helpers (`uuid()`, `formatSessionName()`).
- `src/lib/storage.ts`: Chrome storage CRUD. Exports `KEYS` (`sessions`, `settings`, `recording`, `windowMap`, `incognitoCache`, `pendingClose`). Session helpers: `getSessions` (pinned-first sort via `compareSessions`), `saveSession`, `renameSession`, `togglePin`, `deleteSession`, `deleteAllSessions`. Settings: `getSettings`, `updateSettings`. Recording: `getRecording`, `startRecording`, `addTabToRecording`, `stopRecording`, `cancelRecording`. Caches: `getWindowMap`, `saveWindowMap`, `getIncognitoCache`, `saveIncognitoCache`. Browser-close buffer: `getPendingClose`, `savePendingClose`, `clearPendingClose`. Import/Export: `buildExportPayload`, `importSessions`, `EXPORT_VERSION`. Utility: `getStorageUsage`, `enforceLimit` (auto-save-first, never prunes pinned).
- `src/lib/tabs.ts`: tab capture/restore logic. Exports `toSavedTab()` (shared mapper from `chrome.tabs.Tab` to `SavedTab`), `isRestorable()`, `captureWindow()`, `captureAllWindows()`, `createSnapshot()`, `restoreSession()`, `getTabStats()`.
- `src/entrypoints/background.ts`: service worker. Message router, badge management, proactive per-window tab cache (`tabCache` Map, unified for incognito and normal windows), window map, window lifecycle listeners, browser-close logic with pending-close buffer, live recording capture, context menu, keyboard shortcut (`Alt+Shift+S`), and omnibox handlers.
- `src/entrypoints/popup/App.svelte`: root component managing views (`'main'` | `'detail'` | `'settings'`), global state, and handler functions including `handleTogglePin`, `handleExport`, `handleImport`.

### Popup Views

The popup is a fixed 400×600px window with three views:
- **Main**: Header → SnapshotBar → RecordingBar → SessionList (with SessionCard items)
- **Detail**: SessionDetail (clicking a session card navigates here, showing all tabs organized by tab groups)
- **Settings**: Toggle switches, max sessions input, storage usage bar, danger zone

### Components

| Component | File | Role |
|---|---|---|
| Header | `src/components/Header.svelte` | Logo, brand name, recording indicator, settings button |
| SnapshotBar | `src/components/SnapshotBar.svelte` | Scope dropdown, snapshot button, record toggle, incognito warning |
| RecordingBar | `src/components/RecordingBar.svelte` | Timer, tab count, recent tabs preview, stop/cancel buttons |
| SessionList | `src/components/SessionList.svelte` | Search input, scrollable list of SessionCards, empty states |
| SessionCard | `src/components/SessionCard.svelte` | Session name (inline rename), badges, metadata, tab group chips, context menu |
| SessionDetail | `src/components/SessionDetail.svelte` | Full session view with collapsible tab groups, favicons, restore/delete/rename |
| Settings | `src/components/Settings.svelte` | Toggle rows, max sessions input, storage bar, danger zone |
| Toast | `src/components/Toast.svelte` | Success/error/warning notifications, auto-dismiss |

## Svelte 5 Constraints

- **No `$effect`**: causes infinite loops in this codebase. Use `$derived` or `$derived.by()` instead.
- **No `$bindable`**: was removed due to prior issues.
- Use `$derived.by(() => { ... })` (not `$derived(() => { ... })`) when the derived value needs a function body. `$derived(() => expr)` creates a derived function, not a derived value; it won't cache and will re-execute on every template access.
- Flex scroll chains: every flex column ancestor needs `min-h-0` for `overflow-y-auto` to work.

## UI Theme

Dark theme using oklch color space. CSS variables defined in `src/entrypoints/popup/style.css`:
- `--bg`, `--card`, `--fg`, `--fg-muted`, `--primary`, `--secondary`, `--border`, `--muted`, `--destructive`, `--recording`, `--warning`
- Tab group colors are in `TAB_GROUP_COLORS` (types.ts), not CSS variables.

## Blocked URLs

These URL prefixes cannot be restored by Chrome and are filtered out: `chrome://`, `chrome-extension://`, `moz-extension://`, `about:`, `edge://`, `brave://`. Use `isRestorable()` from `tabs.ts`.

## Icons

Extension icons live in `src/public/icon/` (16, 32, 48, 128 PNG). The SVG source is `src/assets/icon.svg`. After editing the SVG, regenerate PNGs:
```bash
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/128.png -- resize 128 128
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/48.png -- resize 48 48
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/32.png -- resize 32 32
npx sharp-cli -i src/assets/icon.svg -o src/public/icon/16.png -- resize 16 16
```

## Testing

### Unit Tests (Vitest)

Tests use **Vitest** with a Chrome API mock (`tests/setup.ts`). 81 tests across 3 files:
- `tests/types.test.ts`: `uuid()`, `formatSessionName()`, constants, `DEFAULT_SETTINGS` shape (7 fields).
- `tests/storage.test.ts`: sessions CRUD, settings, recordings, window map, incognito cache, pending-close buffer, pinning (sort + enforce), import/export (valid/invalid payloads, collisions, limit enforcement), limit enforcement.
- `tests/tabs.test.ts`: `isRestorable()`, `toSavedTab()`, capture, snapshot, restore logic.

Coverage: storage.ts 100%, tabs.ts ~70% (uncovered lines are Chrome group recreation internals).

### E2E Tests (Playwright)

End-to-end tests use **Playwright** to launch real Chromium with the extension loaded. 54 tests across 9 files in `e2e/`:

```
e2e/
├── playwright.config.ts       # Config: headed Chromium, single worker
├── fixtures/
│   └── extension.ts           # Custom fixture: launches Chrome + extension, provides popupPage
├── helpers/
│   └── storage.ts             # Seed chrome.storage.local via the service worker
└── tests/
    ├── popup-load.spec.ts     # Popup rendering, header, controls, empty state
    ├── snapshot.spec.ts       # Opens real sites, snapshots, verifies capture
    ├── restore.spec.ts        # Seeds sessions, restores, verifies tabs open
    ├── recording.spec.ts      # Opens sites during recording, verifies capture & dedup
    ├── session-list.spec.ts   # Session display, badges, metadata, search
    ├── session-detail.spec.ts # Detail view, tab groups, collapse/expand
    ├── session-actions.spec.ts# Context menu, rename, delete, confirmation flows
    ├── settings.spec.ts       # Toggles, input, storage bar, persistence
    └── toast.spec.ts          # Toast appearance and auto-dismiss
```

E2E tests require a build first (`npm run build`). They run headed (Chrome extensions cannot run headless). The `e2e/` directory is outside `src/` so it is never included in the extension build. `@playwright/test` is a devDependency only.

Key patterns:
- **Fixture** (`e2e/fixtures/extension.ts`): Uses `chromium.launchPersistentContext` with `--load-extension` to load the built extension. Extracts the extension ID from the service worker URL, navigates to `chrome-extension://<id>/popup.html`.
- **Storage seeding** (`e2e/helpers/storage.ts`): Evaluates `chrome.storage.local.set()` in the service worker context to pre-populate test data.
- **Real site interaction**: Snapshot and recording tests open actual websites (example.com, wikipedia.org, httpbin.org) to verify end-to-end tab capture and restore.
