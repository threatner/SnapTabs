# SnapTabs - Product Requirements Document

## Overview
**SnapTabs** is a Chrome extension (Manifest V3) that snapshots and restores browser tabs instantly, with full incognito support, tab groups, and live recording.

**Stack**: TypeScript, Svelte 5, WXT 0.19, Tailwind CSS 4, Chrome APIs (MV3)
**Popup**: 380px wide, 500-600px tall

---

## Data Models

### SavedTab
| Field | Type | Description |
|-------|------|-------------|
| url | string | Tab URL |
| title | string | Tab title |
| favIconUrl | string? | Favicon URL |
| pinned | boolean | Pinned state |
| isIncognito | boolean | Incognito flag |
| groupId | number? | Tab group ID |
| index | number | Original position |

### SavedTabGroup
| Field | Type | Description |
|-------|------|-------------|
| id | number | Original group ID |
| title | string | Group name |
| color | ColorEnum | gray/blue/red/yellow/green/pink/purple/cyan |
| collapsed | boolean | Collapse state |

### Session
| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| name | string | User name or auto-generated timestamp |
| timestamp | number | Unix epoch ms |
| tabs | SavedTab[] | All captured tabs |
| tabGroups | SavedTabGroup[] | All captured groups |
| windowCount | number | Windows captured |
| hasIncognitoTabs | boolean | Contains private tabs |
| isAutoSave | boolean | Auto-snapshot flag |

### SnapTabsSettings
| Setting | Default | Description |
|---------|---------|-------------|
| autoSnapshotOnClose | false | Auto-save when incognito window closes |
| autoDeleteAfterRestore | false | Purge session after restore |
| maxSessions | 50 | Storage limit |
| showIncognitoWarning | true | Warn when saving incognito tabs |
| restoreIncognitoToIncognito | true | Restore private tabs to private window |
| restoreInNewWindow | false | Open restored tabs in new window |

### LiveRecording
| Field | Type | Description |
|-------|------|-------------|
| id | string | Recording UUID |
| name | string | User name or auto timestamp |
| startedAt | number | Start time |
| windowId | number | Target window (-1 = all) |
| tabs | SavedTab[] | Captured tabs so far |
| isActive | boolean | Recording status |

---

## Storage Architecture

| Key | Storage Type | Data |
|-----|-------------|------|
| `snaptabs_sessions` | chrome.storage.local | Session[] |
| `snaptabs_settings` | chrome.storage.local | SnapTabsSettings |
| `snaptabs_live_recording` | chrome.storage.session | LiveRecording |
| `snaptabs_window_map` | chrome.storage.session | {windowId: boolean} |
| `snaptabs_incognito_tab_cache` | chrome.storage.session | {windowId: SavedTab[]} |

**Quota**: 10 MB (`chrome.storage.local`)

---

## Core Features & Flows

### 1. Manual Snapshot
- User enters optional name, clicks "Snapshot" (or `Alt+Shift+S`)
- Scope toggle: "This window" or "All windows"
- Captures tabs + tab groups from selected scope
- Shows incognito warning if applicable
- Saves to storage, updates badge count

### 2. Auto-Save on Incognito Close
- Background tracks incognito windows in `windowMap`
- Proactively caches incognito tabs via `onCreated/onRemoved/onUpdated` listeners
- When incognito window closes, saves cached tabs as `isAutoSave: true` session
- Only triggers if `autoSnapshotOnClose` setting enabled

### 3. Live Recording
- User clicks "Start Recording" -> background creates LiveRecording
- Badge shows red dot while active
- As tabs load (`status === 'complete'`), they're captured to recording
- URL deduplication prevents duplicates
- Respects window scope (all or specific window)
- "Stop & Save" converts to Session; "Cancel" discards

### 4. Restore Session
- User clicks "Restore" on a session card
- **All tab operations routed through background service worker** (popup closes when Chrome creates tabs)
- Separates regular vs incognito tabs
- Regular -> current window or new window (based on setting)
- Incognito -> new incognito window (if `restoreIncognitoToIncognito`)
- Recreates tab groups with title, color, collapse state
- If `autoDeleteAfterRestore`, removes session after restore

### 5. Search
- Real-time filter across session names, tab titles, and URLs
- Uses `$derived` reactive state (no `$effect`)

### 6. Storage Limit Enforcement
- When saving exceeds `maxSessions`, prunes oldest auto-saves first
- Falls back to oldest manual sessions if needed

---

## UI Components

| Component | Description |
|-----------|-------------|
| **Header** | Logo, app name, tab/window/incognito stats (colored chips), scope toggle, settings gear |
| **SnapshotBar** | Text input for session name + "Snapshot" button. Amber incognito warning banner |
| **RecordingBar** | Idle: "Start Recording" button. Active: red card with pulsing dot, timer, tab preview, stop/cancel |
| **SessionList** | Search input + "Sessions" label with count badge + scrollable card list + empty states |
| **SessionCard** | Left color accent bar (blue/amber/purple by type). Session name, relative time, tab count, window count, badges (AUTO/Private). Hover reveals Restore + Delete. Expandable tab list with favicons |
| **Settings** | Back button, toggle rows (5 boolean settings), number input (maxSessions), storage usage bar, danger zone (delete all with confirm) |
| **Toast** | Fixed top-center pill notification. Green/red/amber with icon. Slide-in animation, 2.5s auto-dismiss |

### UI Layout (Main View)
```
+-- 4px gradient strip (indigo->violet->pink->amber) --+
|                                                        |
|  [Logo] SnapTabs              [This window] [gear]    |
|  [12 tabs] [3 windows] [2 private]                    |
|                                                        |
|  [Session name input......] [camera Snapshot]         |
|  ! Includes 2 incognito tabs                          |
|                                                        |
|  (dot) Start Recording                                |
|                                                        |
|  [magnifier] Search sessions, tabs, URLs...           |
|  SESSIONS                                       (5)   |
|  +--------------------------------------------------+ |
|  | | Morning Research                     2h ago     | |
|  |   8 tabs . 2 win . Private       [Restore] [del] | |
|  |   > Show tabs                                     | |
|  +--------------------------------------------------+ |
|  +--------------------------------------------------+ |
|  | | Work Stuff                   1d ago  AUTO       | |
|  |   15 tabs                     [Restore] [del]    | |
|  |   > Show tabs                                     | |
|  +--------------------------------------------------+ |
+--------------------------------------------------------+
```

### UI Layout (Settings View)
```
+-- 4px gradient strip --+
|                         |
|  [<-] Settings          |
|                         |
|  [toggle rows x5]      |
|  [max sessions input]  |
|                         |
|  STORAGE                |
|  [===----] 2.1/10 MB   |
|                         |
|  DANGER ZONE            |
|  [Delete all sessions]  |
|                         |
+-------------------------+
```

---

## Manifest Permissions

| Permission | Reason |
|-----------|--------|
| `tabs` | Query/create tabs, read URLs and titles |
| `sessions` | Chrome Sessions API |
| `tabGroups` | Query/create/update tab groups |
| `storage` | Persist sessions, settings, recording |
| `contextMenus` | Right-click "Save all tabs" |

**Incognito mode**: `"spanning"` (runs in both regular + incognito contexts)

---

## Background Service Worker Responsibilities

1. **Window tracking** - `windowMap` for incognito detection
2. **Incognito tab caching** - proactive cache via tab listeners
3. **Badge management** - session count (teal) or recording dot (red)
4. **Context menu** - "Save all tabs with SnapTabs"
5. **Keyboard shortcut** - `Alt+Shift+S` -> snapshot
6. **Message handler** - popup <-> background communication for all tab-creating operations
7. **Live recording capture** - auto-capture tabs as they load
8. **Storage listener** - sync badge on external storage changes

---

## Message Protocol (Popup -> Background)

| Action | Payload | Response |
|--------|---------|----------|
| `snapshot` | `name?`, `windowId?` | `Session` |
| `restore` | `sessionId` | `{ success: true }` |
| `startRecording` | `name`, `windowId` | `LiveRecording` |
| `stopRecording` | - | `Session \| null` |
| `cancelRecording` | - | `{ success: true }` |

---

## Key Constraints

- **Critical**: All tab-creating operations MUST go through background (popup closes when Chrome creates/focuses a new tab)
- **No `$effect`** - causes infinite loops in Svelte 5; use `$derived` instead
- **No `$bindable`** - removed due to prior issues
- **Flex scroll chain** - every flex column ancestor needs `min-h-0` for `overflow-y-auto`
- **Blocked URLs**: `chrome://`, `chrome-extension://`, `about:`, `edge://`, `brave://` cannot be restored
- **Storage**: 10 MB quota with automatic pruning

---

## File Structure

```
src/
  lib/
    types.ts          # All interfaces + DEFAULT_SETTINGS
    storage.ts        # Chrome storage CRUD operations
    tabs.ts           # Tab capture/restore/stats logic
  entrypoints/
    background.ts     # Service worker (listeners, messages, cache)
    popup/
      index.html
      main.ts
      style.css
      App.svelte      # Root component + state management
  components/
    Header.svelte
    SnapshotBar.svelte
    RecordingBar.svelte
    SessionList.svelte
    SessionCard.svelte
    Settings.svelte
    Toast.svelte
```
