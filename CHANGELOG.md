# Changelog

All notable changes to SnapTabs are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
