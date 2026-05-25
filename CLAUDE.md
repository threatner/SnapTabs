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
npm run test:e2e       # Run E2E tests against Chromium (Playwright, requires build first)
npm run test:e2e:debug # Run E2E tests in debug mode
npm run test:e2e:brave # Run E2E tests against Brave (set BRAVE_PATH if non-default)
```

## What is SnapTabs

SnapTabs is a Chrome extension (Manifest V3) that snapshots and restores browser tabs, including tab groups, pinned tabs, and incognito tabs. Built with **Svelte 5**, **WXT 0.19**, **Tailwind CSS 4**, and **TypeScript**.

### Features

- **Manual snapshot**: save all open tabs from the current window or all windows with one click. Optional custom name, keyboard shortcut (`Alt+Shift+S`), and right-click context menu.
- **Tab group preservation**: captures and restores tab group names, colors, and collapsed state.
- **Incognito support**: captures incognito tabs (when the extension is enabled in incognito mode) and restores them to incognito windows. Proactive caching ensures tabs are captured before the window closes.
- **Auto-snapshot on browser close** (opt-in, default OFF): when enabled, saves the session as an auto-save named `Browser close - <date>` when the last window closes. Multi-window Cmd+Q is handled via a pending-close buffer persisted to `chrome.storage.session` with a 5-second staleness window, which accumulates each closing window's cached tabs and flushes a single combined session when `remaining.length === 0`. **All `chrome.windows.onRemoved` callbacks are serialized through `closeChain.enqueue` (`createCloseChain` in `src/lib/browserClose.ts`)** so concurrent multi-window close events can't race on the buffer or both observe `remaining.length === 0`. **SW-survival fallback**: a debounced `lastSnapshot` (`chrome.storage.local`, key `snaptabs_last_snapshot`) is continuously updated with every open non-incognito tab. On the next fresh browser start — detected by the absence of `snaptabs_session_marker` in `chrome.storage.session` — `recoverLastSnapshot()` promotes it to a `Browser close (recovered)` session if the handler-path save didn't land. Dedupes against a recent matching auto-save via `urlSetSignature` so a successful close never produces a duplicate. This was added because Brave terminates the MV3 service worker more aggressively than Chrome during shutdown.
- **Auto-save on incognito close**: optionally auto-save incognito tabs when an incognito window is closed. Uses the same proactive tab cache.
- **Live recording**: record new tabs as they open in a window (or all windows), then save the session. URL deduplication, pulsing badge indicator, real-time tab count.
- **Session restore**: restore to current window or a new window. Incognito tabs go to an incognito window when the setting is enabled. Auto-delete after restore is optional.
- **Session pinning**: pin sessions so they sort to the top and are exempt from auto-pruning. Available via the card context menu and the detail-view toolbar button.
- **Import / Export**: download all sessions to a JSON file (`snaptabs-export-YYYY-MM-DD.json`) or load from a previous export. Import handles ID collisions by renaming on conflict and skipping exact re-imports (same id + timestamp).
- **Omnibox search**: `st <query>` in Chrome's address bar fuzzy-matches tab titles and URLs across every saved session. Selecting a suggestion opens the tab (Alt+Enter for new tab); raw text with no selection falls back to Google search.
- **Search** (popup): real-time filter across session names, tab titles, and URLs.
- **Duplicate snapshot warning**: before saving a manual snapshot from the popup, compares the candidate tab set against the most recent session via a URL-set signature (order-, fragment-, trailing-slash-insensitive; `isRestorable`-filtered on both sides). If matched, shows a confirm modal with "Cancel" / "Save anyway". Context-menu and keyboard-shortcut snapshots bypass the check. Controlled by `warnOnDuplicateSnapshot` (default true).
- **Excluded domains**: per-domain skip list applied at capture time (manual snapshot, live recording, auto-save on close). Exact host or subdomain match — `github.com` matches `api.github.com`. Input is normalized (strips protocol, `www.`, path, query, casing). Lives in `excludedDomains: string[]` setting.
- **Storage management**: 10 MB quota with automatic pruning (oldest auto-saves removed first, pinned sessions never pruned). Configurable session limit (1-500). Storage usage bar in settings.
- **Settings**: 9 options grouped into 6 sections in the order: **Auto-Save** (auto-snapshot on browser close [default false], auto-save on incognito close), **Snapshot** (warn on duplicate snapshot [default true], excluded domains [default []]), **Restore** (open in new window, auto-delete after restore, restore private to private), **Warnings** (show incognito warning), **Storage** (max sessions limit), **Data** (import/export, clear all in Danger zone). Section order is importance-first — Auto-Save is the headline behavior.

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
- **Background → Storage**: `chrome.storage.local` for persistent data (sessions, settings, `lastSnapshot` for browser-close recovery), `chrome.storage.session` for ephemeral data (live recording, window map, proactive per-window tab cache, pending-close buffer, `sessionMarker` for fresh-start detection).
- **Storage quota**: 10 MB. Automatic pruning removes oldest auto-saves first when `maxSessions` is exceeded; pinned sessions are skipped. If all prunable sessions are pinned, `enforceLimit` breaks out and the list is allowed to exceed `maxSessions` as a soft cap.
- **Omnibox**: `chrome.omnibox` `onInputChanged` / `onInputEntered` handlers live in `background.ts`. Suggestions are ranked by (title match 100 + url match 40 + session-name match 10 + pinned bonus 5), capped at 8 results, deduped by URL.

### Key Modules

- `src/lib/types.ts`: all interfaces (`Session` including optional `pinned`, `SavedTab`, `SavedTabGroup`, `SnapTabsSettings`, `LiveRecording`), shared constants (`DEFAULT_SETTINGS`, `BLOCKED_URL_PREFIXES`, `TAB_GROUP_COLORS`), helpers (`uuid()`, `formatSessionName()`, plus domain helpers `normalizeDomain()`, `getHostname()`, `urlMatchesDomain()`, `isExcludedUrl()` used by the excluded-domains feature).
- `src/lib/storage.ts`: Chrome storage CRUD. Exports `KEYS` (`sessions`, `settings`, `recording`, `windowMap`, `incognitoCache`, `pendingClose`, `lastSnapshot`, `sessionMarker`). Session helpers: `getSessions` (pinned-first sort via `compareSessions`), `saveSession`, `renameSession`, `togglePin`, `deleteSession`, `deleteAllSessions`. Settings: `getSettings`, `updateSettings` (backward-compatible — legacy stored settings missing new fields fall back to defaults via `{ ...DEFAULT_SETTINGS, ...stored }`). Recording: `getRecording`, `startRecording`, `addTabToRecording`, `stopRecording`, `cancelRecording`. Caches: `getWindowMap`, `saveWindowMap`, `getIncognitoCache`, `saveIncognitoCache`. Browser-close buffer: `getPendingClose`, `savePendingClose`, `clearPendingClose`. Last-snapshot recovery: `getLastSnapshot`, `saveLastSnapshot`, `clearLastSnapshot`, `hasSessionMarker`, `setSessionMarker`. Import/Export: `buildExportPayload`, `importSessions`, `EXPORT_VERSION`. Utility: `getStorageUsage`, `enforceLimit` (auto-save-first, never prunes pinned).
- `src/lib/tabs.ts`: tab capture/restore logic. Exports `toSavedTab()` (shared mapper from `chrome.tabs.Tab` to `SavedTab`), `isRestorable()`, `captureWindow()`, `captureAllWindows()`, `createSnapshot()` (reads `excludedDomains` from settings and filters captured tabs before saving; recomputes `hasIncognitoTabs` post-filter), `restoreSession()`, `getTabStats()`, plus dedup helpers `urlSetSignature()` and `findDuplicateSession()` (filters non-restorable URLs on both sides; only compares against most-recent session).
- `src/lib/browserClose.ts`: pure, testable browser-close logic extracted from the service worker. Exports `createCloseChain()` (returns `{ enqueue, drain }` — serializes `onRemoved` work onto a single promise chain so concurrent multi-window close events can't race on the pending-close buffer), `processNormalWindowClose(tabs, isLastWindow, now?)` (accumulates into the pending buffer, flushes a combined "Browser close" session when last window), `recoverLastSnapshot(settings)` (called at SW init; on a fresh browser start, promotes `lastSnapshot` to a `Browser close (recovered)` session if the handler-path save didn't land; dedupes via URL-set signature), and the `PENDING_CLOSE_STALE_MS` constant.
- `src/entrypoints/background.ts`: service worker. Message router, badge management, proactive per-window tab cache (`tabCache` Map, unified for incognito and normal windows), window map, window lifecycle listeners, browser-close logic — `onRemoved` callbacks are funneled through a single `closeChain.enqueue` so they run serially, then dispatch to `processNormalWindowClose` (normal) or the inline incognito save path; live recording capture (filters `excludedDomains` per tab update); context menu; keyboard shortcut (`Alt+Shift+S`); omnibox handlers; debounced `writeLastSnapshot()` and init-time `recoverLastSnapshot()` for the SW-survival fallback.
- `src/entrypoints/popup/App.svelte`: root component managing views (`'main'` | `'detail'` | `'settings'`), global state, and handler functions including `handleTogglePin`, `handleExport`, `handleImport`, plus duplicate-snapshot pre-check (`checkDuplicateSnapshot`) and confirm modal (`dupModalOpen` / `confirmDuplicateSnapshot` / `cancelDuplicateSnapshot`).

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

Tests use **Vitest** with a Chrome API mock (`tests/setup.ts`). 150 tests across 4 files:
- `tests/types.test.ts`: `uuid()`, `formatSessionName()`, constants, `DEFAULT_SETTINGS` shape (9 fields), domain helpers (`normalizeDomain`, `getHostname`, `urlMatchesDomain`, `isExcludedUrl`) with subdomain/substring/case edge cases.
- `tests/storage.test.ts`: sessions CRUD, settings (including `warnOnDuplicateSnapshot`, `excludedDomains`, and backward compat with legacy stored settings), recordings, window map, incognito cache, pending-close buffer, pinning (sort + enforce), import/export (valid/invalid payloads, collisions, limit enforcement).
- `tests/tabs.test.ts`: `isRestorable()`, `toSavedTab()`, capture, snapshot (including excluded-domain filtering, subdomain matching, post-filter `hasIncognitoTabs` recompute, empty-after-filter), restore logic, `urlSetSignature()`, `findDuplicateSession()`.
- `tests/browserClose.test.ts`: `createCloseChain` (serial ordering, error resilience), `processNormalWindowClose` (single-window holds buffer, last-window flushes, stale reset, clears `lastSnapshot` on save, serialized concurrent 3-window close + sanity-check that the unserialized version drops tabs), `recoverLastSnapshot` (no-op when marker set / feature off, promotes on fresh start, dedupes via URL-set signature, re-applies excluded-domain filter, idempotent), and `lastSnapshot`/`sessionMarker` storage round-trips.

Coverage: storage.ts 100%, tabs.ts ~70% (uncovered lines are Chrome group recreation internals), browserClose.ts ~100%.

### E2E Tests (Playwright)

End-to-end tests use **Playwright** to launch real Chromium (or Brave via `--project=brave`) with the extension loaded. 73 tests across 11 files in `e2e/`:

```
e2e/
├── playwright.config.ts            # Config: headed Chromium + brave project, single worker
├── fixtures/
│   └── extension.ts                # Custom fixture: launches Chrome + extension, provides popupPage
├── helpers/
│   └── storage.ts                  # Seed chrome.storage.local via the service worker
└── tests/
    ├── popup-load.spec.ts          # Popup rendering, header, controls, empty state
    ├── snapshot.spec.ts            # Opens real sites, snapshots, verifies capture
    ├── restore.spec.ts             # Seeds sessions, restores, verifies tabs open
    ├── recording.spec.ts           # Opens sites during recording, verifies capture & dedup
    ├── session-list.spec.ts        # Session display, badges, metadata, search
    ├── session-detail.spec.ts      # Detail view, tab groups, collapse/expand
    ├── session-actions.spec.ts     # Context menu, rename, delete, confirmation flows
    ├── settings.spec.ts            # Toggles, input, storage bar, persistence
    ├── dedupe.spec.ts              # Duplicate-snapshot modal: trigger, Cancel, Save anyway, backdrop dismiss, bypass when setting off
    ├── excluded-domains.spec.ts    # Settings UI (empty state, add/remove, normalization, persistence) + snapshot integration (filtering, subdomain match)
    └── toast.spec.ts               # Toast appearance and auto-dismiss
```

E2E tests require a build first (`npm run build`). They run headed (Chrome extensions cannot run headless). The `e2e/` directory is outside `src/` so it is never included in the extension build. `@playwright/test` is a devDependency only.

The `brave` project runs the same suite against the Brave binary (`npm run test:e2e:brave`); the fixture resolves the binary from `BRAVE_PATH` / `BROWSER_PATH` env vars or `testInfo.project.metadata.executablePath` (default platform paths in `playwright.config.ts`). Multi-window Cmd+Q can't be simulated reliably in Playwright, so the browser-close race fix is covered by `tests/browserClose.test.ts` rather than E2E.

Key patterns:
- **Fixture** (`e2e/fixtures/extension.ts`): Uses `chromium.launchPersistentContext` with `--load-extension` to load the built extension. Extracts the extension ID from the service worker URL, navigates to `chrome-extension://<id>/popup.html`.
- **Storage seeding** (`e2e/helpers/storage.ts`): Evaluates `chrome.storage.local.set()` in the service worker context to pre-populate test data.
- **Real site interaction**: Snapshot and recording tests open actual websites (example.com, wikipedia.org, httpbin.org) to verify end-to-end tab capture and restore.
