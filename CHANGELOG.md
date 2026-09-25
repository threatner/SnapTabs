# Changelog

All notable changes to SnapTabs are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2026-09-25

### Fixed

- **Multi-window sessions now restore as multiple windows.** A session saved from several windows (an all-windows snapshot, or a browser-close auto-save with more than one window open) came back as a single window, and because tab positions are per-window, tabs from different windows were shuffled together. Each saved window now comes back as its own window, in order. Sessions saved by earlier versions are fixed too: SnapTabs infers their window boundaries from the saved tab order.
- **Tabs that were still loading are no longer saved as blank tabs.** Snapshotting a tab mid-navigation saved an empty URL, which restored as a New Tab page.
- **Saves no longer overwrite each other.** Two saves landing at the same moment (for example an auto-save and a manual snapshot, or two tabs finishing loading during a live recording) could silently drop one of them. Writes to sessions, settings, and live recordings are now serialized across the popup, the welcome page, and the background worker.
- **Changes made in the popup always stick.** Settings, renames, and "delete all" are now carried out by the background worker, so closing the popup right after a click can't lose the change.
- **No more stray "Browser close (recovered)" sessions after an extension update.** Chrome resets the extension's session state on updates as well as on browser restarts, so with "Save on browser close" on, every SnapTabs update created a recovered session of the tabs you still had open. Recovery now skips an update when every tab is still open; a restart that loses tabs still recovers them.
- **Failed actions are reported as failures.** Restoring a session that had been deleted elsewhere used to show "Restored"; it now shows an error.

### Added

- **Sleep restored tabs** (on by default, Settings > Restore). After a restore, background tabs unload once they've loaded, so a 60-tab session leaves one live tab per window instead of 60. They keep their title and icon in the tab strip and reload when you click them. Restore now also focuses the first restored tab instead of the last.
- **Rolling backup** (off by default, Settings > Auto-Save). Keeps a single, always-fresh "Rolling backup" session of your open tabs, refreshed every 5, 15, 30, or 60 minutes, only when something changed. If a browser restart or a big window closing would make the backup lose tabs, the previous backup is kept as its own session first. Never includes incognito windows, never counts toward your session limit, and turning it off leaves the last backup as a normal auto-save.
- **Welcome page** on first install: two steps: pin SnapTabs to the toolbar (the extensions and pin icons are shown inline, and it detects when you've pinned), and opt in to save-on-close and the rolling backup. Only for new installs, never on updates.
- **A one-time rating request.** After 5 manual snapshots or 3 restores (whichever comes first), the popup asks once whether you'd rate SnapTabs. Dismissing it or rating hides it for good. A permanent **Rate SnapTabs** link also sits in Settings > Feedback. Existing users are counted from the sessions they already have, so long-time users are asked soon after updating.
- **Local usage stats.** SnapTabs now keeps simple counters on your device (manual snapshots, recordings, auto-saves, restores of snapshots vs auto-saves, first-seen date) to decide when to show one-time prompts. They never leave your browser and aren't included in exports.
- **Optional uninstall feedback.** Groundwork for a short, optional "why are you leaving?" form after uninstalling (not active until a form is configured). Nothing is attached to it.

### Changed

- New `alarms` permission, used only to schedule the optional rolling backup. It does not trigger a permission prompt.
- Privacy policy updated for the rolling backup, the uninstall form, and the new permission.

### Internal

- New modules: `sleepTabs.ts`, `backup.ts`, `links.ts`, `messages.ts`; welcome page entrypoint.
- Test coverage: 247 unit tests and 93 Playwright E2E tests (passing on Chromium and Brave), plus a new real-browser suite (`npm run test:e2e:cdp`, 16 checks, passing on Chromium and Brave) for behaviour Playwright can't drive: tab sleeping (Playwright loses its connection on tab discard), backup alarms across service-worker restarts, and crash recovery across a browser restart.
- Verified a real v1.8.0 → v1.9.0 profile upgrade: sessions untouched, settings kept with new defaults, no welcome page, and v1.8 multi-window snapshots restore correctly.

## [1.8.0] - 2026-07-16

### Added

- **GitHub feedback links.** The popup header now has a GitHub icon next to the settings button that opens the SnapTabs repository, and **Settings** gained a new **Feedback** section ("Have an issue or a suggestion?") linking straight to the GitHub issues page for bug reports and feature requests.

## [1.7.0] - 2026-07-09

### Changed

- **Session count moved from the toolbar badge to the popup.** The extension badge no longer shows the number of stored sessions — it is now recording-only (a red ● while live recording, empty otherwise). The count appears as a "N sessions saved" subtitle under the brand name in the popup header instead.

## [1.6.0] - 2026-06-12

### Fixed

- **Tab group names are now saved on auto-save, not just manual snapshots** ([#7](https://github.com/threatner/SnapTabs/issues/7)). When auto-saving on browser close (or incognito-window close, or service-worker crash recovery), tab group names, colors, and collapsed state were being dropped — restored sessions came back with bare, unnamed groups. The proactive per-window cache only kept tab data, so every auto-save path saved empty `tabGroups`. The cache now captures tab-group metadata alongside tabs, so a browser-close session restores its groups exactly like a manual snapshot does.

### Added

- **Sort the session list.** A dropdown next to the search box orders saved sessions by Newest (default), Oldest, Name (A–Z), or Most tabs. Pinned sessions always stay on top regardless of the chosen sort.

### Internal

- Unified the separate per-window tab cache and tab-group cache into a single `windowCache` (`Map<number, WindowCapture { tabs, groups }>`) persisted in one write, so tabs and groups can't drift out of sync. New `chrome.storage.session` key `snaptabs_window_cache` replaces the old `snaptabs_incognito_tab_cache` / group-cache keys.
- New shared `mergeGroups` helper in `tabs.ts` (dedupe tab groups by id), reused by `captureAllWindows`, `processNormalWindowClose`, and `writeLastSnapshot`.
- Test coverage: 153 unit tests and 76 Playwright E2E tests (added group-preservation, cross-window group dedup, window-cache round-trip, and session-sort coverage incl. pinned-stays-on-top).

## [1.5.0] - 2026-05-26

### Fixed

- **Auto-save on browser close is now reliable on Brave** (and under load on Chrome). Two races in the pending-close buffer were silently dropping windows: concurrent `chrome.windows.onRemoved` callbacks read the same empty buffer and the last `savePendingClose` overwrote the others, and `chrome.windows.getAll()` could be observed as 0 or non-zero from multiple callbacks depending on event ordering. Multi-window `Cmd+Q` was the worst-affected case. Window-close handling is now serialized on a single in-SW promise chain, so every window's tabs land in the combined "Browser close" session.
- **Service-worker survival fallback.** Brave terminates the MV3 service worker more aggressively during shutdown than Chrome does, which could cancel the close handler mid-write. SnapTabs now keeps a continuously-updated "last-known-good" snapshot of all open non-incognito tabs in `chrome.storage.local` (debounced on every tab change). On the next fresh browser start, if the handler-path save didn't complete, the snapshot is promoted to a `Browser close (recovered)` session. Deduplicates against a recent matching auto-save via URL-set signature so a successful close never produces a duplicate.

### Changed

- **Settings sections reordered by importance.** Auto-Save first (the headline behaviour, including the fix above), then Snapshot, then Restore (renamed from "Restore Options" — "Open in new window" promoted to top of the group), then Warnings, Storage, Data, Danger.
- **Compact excluded-domains UI.** Replaced the bordered card with empty-state illustration and globe-icon rows with a tag-chip layout — entries are small pills with inline remove buttons, the input is a single short row. No big empty state.

### Internal

- New `src/lib/browserClose.ts` extracts the close handling (`createCloseChain`, `processNormalWindowClose`, `recoverLastSnapshot`) out of the service-worker entrypoint so the race fix and recovery can be unit-tested in isolation.
- New `chrome.storage.local` key `snaptabs_last_snapshot` and `chrome.storage.session` key `snaptabs_session_marker` (the latter distinguishes a fresh browser start from a mid-session SW restart).
- New Playwright project `brave`: `npm run test:e2e:brave` (or `--project=brave`) runs the existing E2E suite against Brave by default-resolving the platform Brave binary path, override with `BRAVE_PATH=…`.
- Test coverage: 150 unit tests (+19 across the new `tests/browserClose.test.ts`, including a sanity-check assertion that the unserialized version of the close handler drops tabs).

## [1.4.0] - 2026-05-25

### Added

- **Duplicate snapshot warning.** Before saving a manual snapshot, SnapTabs compares the tabs about to be captured against your most recent session. If the URL set matches, a confirmation modal asks before saving another copy. The check is order-, fragment-, and trailing-slash-insensitive, and ignores non-restorable URLs (e.g. `chrome://newtab`) on both sides. New `warnOnDuplicateSnapshot` setting in **Settings > Snapshot** (default ON). Only fires from the popup; context-menu and keyboard-shortcut snapshots still save immediately.
- **Excluded domains.** New list in **Settings > Snapshot > Excluded domains** for sites you never want captured (banking, email, internal tools). Tabs from these domains are skipped in manual snapshots, live recordings, and auto-saves on window close. Exact host or subdomain match — adding `github.com` also excludes `api.github.com`. Input accepts URLs and normalizes them (`https://www.GitHub.com/path` becomes `github.com`).

### Changed

- Settings screen reorganized with a new **Snapshot** section at the top. The excluded-domains UI is a unified card with a count pill, empty state, per-row globe icon with hover-revealed remove button, and an inline input bar whose `↵` hint becomes an **Add** button as you type.

### Internal

- Added `urlSetSignature()` and `findDuplicateSession()` helpers in `src/lib/tabs.ts`; `createSnapshot()` filters excluded domains and recomputes `hasIncognitoTabs` after filtering.
- Added `normalizeDomain()`, `getHostname()`, `urlMatchesDomain()`, `isExcludedUrl()` helpers in `src/lib/types.ts`. Settings backward-compatible: legacy stored settings without the new fields fall back to defaults.
- Test coverage: 131 unit tests (30 new), 73 e2e tests (19 new across `dedupe.spec.ts` and `excluded-domains.spec.ts`). Fixed two pre-existing stale-copy assertions in `popup-load.spec.ts` and `session-actions.spec.ts`.

## [1.3.1] - 2026-04-24

### Changed

- **Auto-snapshot on browser close now defaults to OFF.** Turn it on in `Settings > Auto-Save` whenever you want browser-close snapshot behaviour. Nothing is written to storage without an explicit opt-in from the user. The feature and UI are unchanged; only the default flipped.

### Added

- "Latest version" row in the README at-a-glance table. The Chrome Web Store shield badge at the top still auto-updates from the live store version; this row gives visitors the current source version without waiting for CWS review.

## [1.3.0] - 2026-04-24

### Added

- **Auto-snapshot on browser close.** When the last Chrome window closes, SnapTabs saves the open tabs as an auto-session named `Browser close - <date>`. Multi-window `Cmd+Q` is captured as a single combined session via a pending-close buffer with a 5-second staleness window.
- **Chrome Web Store promo tiles.** New 440×280 small promo tile (what CWS uses in search autocomplete, and whose absence is why the listing showed name-only) and 1400×560 marquee tile. SVG sources live in `src/assets/promo-*.svg`; `npm run promo` rerenders the PNGs into `screenshots/store/`.
- `STORE_LISTING.md` as the source of truth for Chrome Web Store copy and assets.

### Changed

- Extension name uses a hyphen instead of an em-dash: `SnapTabs - Save & Restore Browser Tabs`.
- `package.json` and `wxt.config.ts` descriptions reworded and em-dashes removed.
- README rewritten around SEO/GEO patterns: definition block up front, at-a-glance facts table, FAQ with seven natural-language questions, specific numbers, comparison against Chrome's built-in history.
- `CLAUDE.md` updated for every shipped feature, new storage keys, new message actions, and an accurate test count (81).

### Internal

- In-memory tab cache now covers every window (previously incognito-only) so closed-window tabs remain accessible inside `chrome.windows.onRemoved`.
- Pending-close buffer persisted to `chrome.storage.session` so service-worker restarts mid-close do not drop the accumulated tabs.

## [1.2.0] - 2026-04-23

### Added

- **Session pinning.** Pin sessions from the card context menu or the detail-view toolbar. Pinned sessions sort to the top of the list and are never pruned when storage fills up.
- **Omnibox search.** Type `st` in Chrome's address bar, press space, then a query, to fuzzy-search tab titles and URLs across every saved session without opening the popup. Enter opens the selected tab; raw text with no selection falls back to a Google search.

### Changed

- `getSessions()` returns results sorted pinned-first, then by timestamp descending.
- `enforceLimit()` now skips pinned sessions when pruning, preferring auto-saves first and never removing pinned entries. If everything prunable is pinned, the limit becomes a soft cap.

## [1.1.0] - 2026-04-23

### Added

- **Import / Export sessions as JSON.** Download every session as `snaptabs-export-YYYY-MM-DD.json` or load from a previous export. Import handles ID collisions by renaming on conflict and skips exact re-imports (same `id + timestamp`).
- Settings page polish:
  - Storage usage card nested under the Storage section; bar turns amber past 80% usage.
  - Version pill in the Settings header.
  - New "Data" section with Export and Import buttons side by side.
- Warmer first-run empty state with a primary-tinted icon, bolded CTA words, and a gently bouncing arrow pointing at the Snapshot button.
- Session-card hover gains a 3 px primary-color left-edge accent, a chevron nudge, and an active state, so cards feel clickable.

## [1.0.0] - 2026-03-15

### Added

- Initial Chrome Web Store release.
- One-click snapshot of the current window or every open window, with optional custom name and timestamp-based auto-naming.
- Tab group preservation: group name, color, and collapsed state are captured and restored.
- Incognito support with proactive tab caching so tabs are captured before the window closes.
- Optional auto-save when an incognito window closes.
- Live recording: captures each new tab as it opens, with URL deduplication and a pulsing badge indicator.
- Session restore to the current window or a new window, with optional auto-delete after restore.
- Real-time search across session names, tab titles, and URLs.
- Storage management: 10 MB quota, configurable max-sessions limit from 1 to 500, automatic pruning of oldest auto-saves, visual usage bar in Settings.
- Keyboard shortcut `Alt+Shift+S` to snapshot without opening the popup.
- Right-click "Save all tabs with SnapTabs" context menu on the toolbar icon.
- Manifest V3, Chrome 93+, four minimum-necessary permissions (`tabs`, `tabGroups`, `storage`, `contextMenus`).
- All data stored locally in `chrome.storage.local`. No cloud sync, no analytics, no outbound network requests.
